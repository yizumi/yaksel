# yaksel

This is a DeepL based language translator for Slack.
Yaksel will run as a Slack App so it can handle various translation requests from Slack and post the translated message back.
You'll need API key to run the translation on DeepL.

## How it works
It is meant to run on Firebase infrastructure and it will use both Cloud Functions and Realtime Database:

* Cloud Functions - hosts the bot function so it can respond to Slack events
* Real-time Database - keeps the track of translation history (to avoid duplicate messages) and auto-translate settings

```
+-------+    +------------------------+    +-----------+
| Slack |--->| Yaksel Bot on Firebase |--->| DeepL API |
+-------+    +------------------------+    +-----------+
```

* The Yaksel bot will wait for events from Slack
* Once Slack sends an event, `Yaksel.handleEvent` will be called, the message gets interpreted, takes whatever action needed.
* When it's requested to translate a message, it takes the text content to DeepL and posts the translated message back to Slack.

## Setup

### Prerequisites
This instruction will assume you already have the following installed:

* yarn
* firebase-tools

### Installation

First install all dependencies using `yarn`, then configure the firebase project settings using `firebase`
```
$ yarn install
$ firebase init
```

### Configuration

#### Local configuration:
Copy the sample configuration file so that 
```
$ cd functions/src
$ cp .appConfig.example.ts .appConfig.local.ts
$ vim .appConfig.local.ts
```

* `app.realtime_database_url` - get it from your firebase project
* `slack.apikey` - see the "OAuth & Permissions" settings tab in your Slack App
* `deepl.apikey` - goto DeepL's web-page, and get the API key

#### Production configuration
For the production configuration, you'll need to set the values for these variables using firebase-tools

```
$ firebase functions:config:set app.realtime_database_url="xxx" slack.apikey="xxx" deepl.apikey="xxx"
```

### Test
To test the application, you can simply call the `test` script using yarn.

```
$ yarn test
```

### Directory Structure

```
functions/src
|- models: Contains abstracted datamodels of Slack events, messages and users.
|- services: Contains the implementations of various services to enable translation
|- index.ts: The entrypoint for the Cloud Functions API call
```

### Deploy

Make sure you have configuration variables set for production. If you're not sure, you can always examine it by calling `firebase functions:config:export`

Deploy only takes you to enter the following command
```
$ yarn deploy
```

# Addendum

## Real-time Database Structure

There are two objects stored in the database.

### Translation history
Stores the time-stamp of messages that has been translated already.
This is needed because one event in Slack can possibly trigger two events.

### Auto-translation settings
It keeps the ID of users (or bots) that has auto-translation enabled.
The value indicates the target language for the translation.

```
+(root)
|-channels
| |-C01XXXXXXXX
| | |-1663482586_086500: true
| |-C02XXXXXXXX
| | |-1663811306_114200: true
|-autotranslate
  |-U01XXXXXX: "en"
  |-B02XXXXXX: "ja"
```

