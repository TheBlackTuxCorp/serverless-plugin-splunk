'use strict'

const _ = require('lodash')
const path = require('path')
const fs = require('fs')

class SplunkPlugin {
  constructor (serverless, options) {
    this.serverless = serverless
    this.options = options
    this.provider = this.serverless.getProvider('aws')

    this.stage = (this.options.stage && (this.options.stage.length > 0)) ? this.options.stage : service.provider.stage

    this.hooks = {
      'before:package:initialize': this.update.bind(this),
      'before:package:compileFunctions': this.add.bind(this)
    }
  }

  /**
   * Add Splunk function to this package
   */
  add () {
    const service = this.serverless.service
    const stage = this.stage
    const serviceName = stage ? `${service.service}-${stage}` : service.service

    if (service.custom.splunk.arn) {
      // Use a function that already exists
      return
    }

    service.provider.environment.SPLUNK_HEC_URL = service.custom.splunk.url
    service.provider.environment.SPLUNK_HEC_TOKEN = service.custom.splunk.token

    const functionPath = path.resolve(__dirname, 'splunk/splunk-cloudwatch-logs-processor')

    if (!fs.existsSync(functionPath)) {
      fs.mkdirSync(functionPath)
    }

    service.functions[`${serviceName}-splunk`] = {
      handler: 'index.handler',
      events: []
    }
  }

  /**
   * Updates CloudFormation resources with Splunk Resources
   */
  update () {
    const service = this.serverless.service
    const stage = this.stage

    if (service.custom.splunk) {
      if (service.custom.splunk.excludestages &&
        service.custom.splunk.excludestages.includes(stage)) {
        this.serverless.cli.log(`Splunk is ignored for ${stage} stage`)
        return
      }
    }

    this.serverless.cli.log('Updating Splunk Resources...')
    const resource = this.create()
    if (this.serverless.service.resources === undefined) {
      this.serverless.service.resources = {
        Resources: {}
      }
    } else if (this.serverless.service.resources.Resources === undefined) {
      this.serverless.service.resources.Resources = {}
    }
    _.extend(this.serverless.service.resources.Resources, resource)
    this.serverless.cli.log('Splunk Resources Updated')
  }

  /**
   * Creates CloudFormation resources object with CICD Role, CodeBuild, CodePipeline
   * @return {Object} resources object
   */
  create () {
    const service = this.serverless.service
    const stage = this.stage
    const serviceName = stage ? `${service.service}-${stage}` : service.service

    let destination = null
    if (service.custom.splunk.arn) {
      destination = service.custom.splunk.arn
    } else {
      destination = {
        'Fn::GetAtt': [
          `${serviceName}-splunk`,
          'Arn'
        ]
      }
    }

    const resources = {}

    const LogBase = {
      Type: 'AWS::Logs::SubscriptionFilter',
      Properties: {
        DestinationArn: destination,
        FilterPattern: ''
      },
      DependsOn: ['splunkLambdaPermission']
    }

    const principal = `logs.${service.provider.region}.amazonaws.com`
    const splunkLambdaPermission = {
      Type: 'AWS::Lambda::Permission',
      Properties: {
        FunctionName: destination,
        Action: 'lambda:InvokeFunction',
        Principal: principal
      }
    }

    service.getAllFunctions().forEach((functionName) => {
      if (functionName !== `${serviceName}-splunk`) {
        console.log(functionName)
        console.log(service.getFunction(functionName))
        let log = LogBase

        log.Properties.LogGroupName = `/aws/lambda/${functionName}`

        let logName = functionName + 'Splunk'

        log.DependsOn.push(functionName)

        _.extend(resources, { [`${logName}`]: log })
      }
    })

    if (service.custom[stage]) {
      gitBranch = service.custom[stage].branch
    }

    if (service.custom.cicd) {
      if (service.custom.cicd.image != null) {
        image = service.custom.cicd.image
      } else if (service.provider.runtime.includes('node')) {
        image = nodeImage
      } else if (service.provider.runtime.includes('python')) {
        image = pythonImage
      }

      gitOwner = service.custom.cicd.owner || ''
      gitRepo = service.custom.cicd.repository || gitRepo
      gitBranch = service.custom.cicd.branch || gitBranch
      githubOAuth = service.custom.cicd.githubtoken || ''
    }

    const resource = {}

    // This role has a lot of access, but depending what you do with your buildspec
    // it might be needed!
    const role = {
      CICDRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: `${serviceName}-${stage}`,
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [ {
              Effect: 'Allow',
              Principal: {
                Service: [ 'codepipeline.amazonaws.com' ]
              },
              Action: [ 'sts:AssumeRole' ]
            }, {
              Effect: 'Allow',
              Principal: {
                Service: [ 'codebuild.amazonaws.com' ]
              },
              Action: [ 'sts:AssumeRole' ]
            } ]
          },
          Policies: [ {
            PolicyName: `${serviceName}-${stage}`,
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [ {
                Effect: 'Allow',
                Action: [
                  'elasticbeanstalk:*',
                  'ec2:*',
                  'elasticloadbalancing:*',
                  'autoscaling:*',
                  'cloudwatch:*',
                  's3:*',
                  'sns:*',
                  'cloudformation:*',
                  'rds:*',
                  'sqs:*',
                  'ecs:*',
                  'codedeploy:*',
                  'codecommit:*',
                  'codebuild:*',
                  'codepipeline:*',
                  's3:*',
                  'lambda:*',
                  'opsworks:*',
                  'logs:*',
                  'apigateway:*',
                  'kinesis:*',
                  'dynamodb:*',
                  'events:*',
                  'iam:*'
                ],
                Resource: '*'
              } ]
            }
          } ]
        }
      }
    }

    const build = {
      Build: {
        Type: 'AWS::CodeBuild::Project',
        Properties: {
          Name: `${serviceName}-${stage}`,
          ServiceRole: {
            'Fn::GetAtt': [
              'CICDRole',
              'Arn'
            ]
          },
          Artifacts: {
            Type: 'CODEPIPELINE',
            Name: `${serviceName}-${stage}-build`,
            Packaging: 'NONE'
          },
          Environment: {
            Type: 'LINUX_CONTAINER',
            ComputeType: 'BUILD_GENERAL1_SMALL',
            Image: `${image}`,
            EnvironmentVariables: [ {
              Name: 'STAGE',
              Value: `${stage}`
            } ]
          },
          Source: {
            Type: 'CODEPIPELINE'
          },
          TimeoutInMinutes: 60
        }
      }
    }

    const pipeline = {
      Pipeline: {
        Type: 'AWS::CodePipeline::Pipeline',
        Properties: {
          Name: `${serviceName}-${stage}`,
          RoleArn: {
            'Fn::GetAtt': [
              'CICDRole',
              'Arn'
            ]
          },
          Stages: [ {
            Name: 'Source',
            Actions: [ {
              Name: 'Source',
              ActionTypeId: {
                Category: 'Source',
                Owner: 'ThirdParty',
                Version: '1',
                Provider: 'GitHub'
              },
              OutputArtifacts: [ { Name: `${serviceName}` } ],
              Configuration: {
                Owner: `${gitOwner}`,
                Repo: `${gitRepo}`,
                Branch: `${gitBranch}`,
                OAuthToken: `${githubOAuth}`
              },
              RunOrder: '1'
            } ]
          }, {
            Name: 'Build',
            Actions: [ {
              Name: 'CodeBuild',
              InputArtifacts: [ { Name: `${serviceName}` } ],
              ActionTypeId: {
                Category: 'Build',
                Owner: 'AWS',
                Version: '1',
                Provider: 'CodeBuild'
              },
              OutputArtifacts: [ { Name: `${serviceName}Build` } ],
              Configuration: {
                ProjectName: {
                  'Ref': 'Build'
                }
              },
              RunOrder: '1'
            } ]
          } ],
          ArtifactStore: {
            Type: 'S3',
            Location: { 'Ref': 'ServerlessDeploymentBucket' }
          }
        }
      }
    }

    _.extend(resource, role, build, pipeline)

    return resource
  }
}

module.exports = SplunkPlugin
