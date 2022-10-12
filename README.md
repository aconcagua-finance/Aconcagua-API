# vs-core

GCP application framework.
firebase login:ci >> obtiene token FIREBASE_TOKEN

## Project Status

[![license](https://img.shields.io/npm/l/vs-core.svg)](https://github.com/abdalamichel/vs-core/blob/master/LICENSE)
[![npm version](https://badge.fury.io/js/vs-core.svg)](https://github.com/abdalamichel/VS-Core/packages/1099576)
![Build Status](https://github.com/abdalamichel/vs-core/actions/workflows/github-npm-publish-on-release-created.yml/badge.svg)
[![codecov](https://codecov.io/gh/abdalamichel/vs-core/branch/master/graph/badge.svg)](https://codecov.io/gh/abdalamichel/vs-core)<br/>
[![NPM](https://nodei.co/npm/vs-core.png?downloads=true&downloadRank=true&stars=true)](https://github.com/abdalamichel/VS-Core/packages/1099576)

## Documentation

[Full API documentation](docs/API.md) - Learn about each method

## Getting Started

Setup your firebase application on https://firebase.google.com/

## Install

```sh
npm install @abdalamichel/vs-core@0.0.9 -g
```

### Creating a new application

- Initialize a new application (this will download the application [vs-core-template](https://github.com/abdalamichel/vs-core-template/))

```sh
vs-core init -n newapp
```

- Modify the application name in `package.json`
- Follow the steps in [vs-core-template/DEVELOPMENT.md](https://github.com/abdalamichel/vs-core-template/blob/master/DEVELOPMENT.md) to get your application
  running.

### USEFULL

- https://docs.github.com/es/packages/working-with-a-github-packages-registry/working-with-the-npm-registry
- npm i firebase@latest
  > VSCode utils
- nvm alias default v16.17.1

- $ npm login --scope=abdalamichel --registry=https://npm.pkg.github.com

- Username: USERNAME
- Password: TOKEN
- Email: PUBLIC-EMAIL-ADDRESS

- Para crear FIREBASE TOKEN
  firebase login:ci

- Crear los secrets:
- NODE_AUTH_TOKEN: ${{secrets.VS_GITHUB_NPM_TOKEN}}
- VS_GITHUB_NPM_TOKEN: ${{secrets.VS_GITHUB_NPM_TOKEN}}
- FIREBASE_TOKEN: ${{secrets.FIREBASE_TOKEN}}

Calendar integration:

- Configure google calendar api
- Create credential OAuth2 and set Authorized redirect URIs to "http://localhost:5001/\*\*\*/us-central1/googleOAuth/oauth2callback and the prod url
- copy the credential clientId and secret and configure .env and secrets (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET)
- also configure redirect url in env, eg GOOGLE_OAUTH_REDIRECT_URL="http://localhost:5001/tryaconcagua-qa/us-central1/googleOAuth/oauth2callback"
- configure google calendar webhook url in env, eg: GOOGLE_CALENDAR_EVENT_WEBHOOK_URL="https://us-central1-tryaconcagua-qa.cloudfunctions.net/userCalendarEvents/google-event-webhook"
