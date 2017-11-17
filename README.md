# serverless-plugin-splunk
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Serverless plugin for adding a function to send logs from Cloudwatch to Splunk and attach it to the log groups for every other function in the package.

# About The Black Tux
The Black Tux is reinventing the formalwear rental industry so guys can show up at their best on the days that matter most. The company designs and manufactures modern rental suits and tuxedos that actually fit—made of 100% wool, ordered online or in one of our showrooms, and delivered for free. Using a combination of machine learning, tailor-trained fit specialists, and industry-leading customer service, The Black Tux guarantees a perfect fit every time.

To support this elevated customer experience we rely on lots of technology. From time to time we release things we build to the open source community when we feel they might be useful by others as well, and of course don't include anything proprietary.

# Getting Started

## Prerequisites
Make sure you have the following installed before starting:
* [nodejs](https://nodejs.org/en/download/)
* [npm](https://www.npmjs.com/get-npm)
* [serverless](https://serverless.com/framework/docs/providers/aws/guide/installation/)

## Installation
First install the package:

```
npm install serverless-plugin-splunk --save
```

Then add the plugin to your `serverless.yml` file:
```yaml
plugins:
  - serverless-plugin-splunk
```

There are a few parameters that you need to use (if you use the arn parameter, the url and token can be omitted):
```yaml
custom:
  splunk:
    url: 'Splunk HTTP event collector URL'
    token: 'Splunk HTTP event collector Token'
    arn: 'AWS ARN of Splunk Logging Function' # Optional
    excludestages: # Optional
      - '[name of a stage to exclude]'
      - '[another stage name to exclude]'
```

### Some details on these parameters
Parameter | Info | Default | More Information
------ | ------ | ------ | ------
url | URL address for your Splunk HTTP event collector endpoint | *blank* | [Default port for event collector is 8088. Example: https://host.com:8088/services/collector](http://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector)
token | Token for your Splunk HTTP event collector | *blank* | [To create a new token](http://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector#Create_an_Event_Collector_token)
arn | AWS ARN of a Splunk Logging Function that already is deployed if you don't want one created by this function | *blank* | [You can use Blueprint II from here](https://www.splunk.com/blog/2016/11/29/announcing-new-aws-lambda-blueprints-for-splunk.html)
excludestages | Stages you don't want logging hooked up for | *blank* | [Serverless stages](https://serverless.com/framework/docs/providers/aws/guide/workflow#using-stages)


## Deploying
---------
The plugin will be packaged with the lambda when deployed as normal using Serverless:
```
serverless deploy
```

# Support
All support is conducted through GitHub issues. This is released basically "as is" but we will answer questions as we can.

# Contributing
Please open a GitHub issue before contributing code changes.
