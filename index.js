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
      'before:package:initialize': this.start.bind(this),
      'after:deploy:deploy': this.cleanup.bind(this)
    }
  }

  /**
   * Start bindings
   */
  start () {
    this.update()
    this.addFunction()
  }

  /**
   * Add Splunk function to this package
   */
  addFunction () {
    const service = this.serverless.service
    const stage = this.stage

    if (service.custom.splunk.arn) {
      // Use a function that already exists
      return
    }

    this.serverless.cli.log('Adding Splunk Function...')

    service.provider.environment.SPLUNK_HEC_URL = service.custom.splunk.url
    service.provider.environment.SPLUNK_HEC_TOKEN = service.custom.splunk.token

    let splunkFile = fs.readFileSync(path.resolve(__dirname, 'splunk/splunk-cloudwatch-logs-processor/index.js'))
    fs.writeFileSync(path.join(this.serverless.config.servicePath, 'splunk.js'), splunkFile)

    service.functions.splunk = {
      handler: `splunk.handler`,
      events: []
    }

    this.serverless.cli.log('Splunk Function Added...')
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
          `SplunkLambdaFunction`,
          'Arn'
        ]
      }
    }

    const resource = {}

    const principal = `logs.${service.provider.region}.amazonaws.com`
    const permission = {
      SplunkLambdaPermission: {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: destination,
          Action: 'lambda:InvokeFunction',
          Principal: principal
        }
      }
    }

    _.extend(resource, permission)

    service.getAllFunctions().forEach((functionName) => {
      if (functionName !== 'splunk') {
        const logicalName = this.provider.naming.getLogGroupLogicalId(functionName)
        const logName = logicalName + 'Splunk'

        let log = {
          [`${logName}`]: {
            Type: 'AWS::Logs::SubscriptionFilter',
            Properties: {
              DestinationArn: destination,
              FilterPattern: ''
            },
            DependsOn: ['SplunkLambdaPermission']
          }
        }

        log[`${logName}`].Properties.LogGroupName = `/aws/lambda/${service.getFunction(functionName).name}`
        log[`${logName}`].DependsOn.push(logicalName)

        _.extend(resource, log)
      }
    })

    return resource
  }

  cleanup () {
    this.serverless.cli.log('Removing temporary Splunk function file')
    let splunkFile = path.join(this.serverless.config.servicePath, 'splunk.js')

    try {
      if (fs.existsSync(splunkFile)) {
        fs.unlinkSync(splunkFile)
      }
    } catch (err) {
      throw new Error(err)
    }
  }
}

module.exports = SplunkPlugin
