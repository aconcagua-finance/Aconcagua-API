const { CustomError } = require('../../vs-core');

const { errorLogger, EVENT_TYPE_NAVIGATION, EVENT_TYPE_CRON } = require('../helpers/loggerHelper');

const { ENVIRONMENT } = process.env;

const isHttpError = function (err) {
  return err && err.isAxiosError && err.config && err.response;
};

const beautifyError = function (err) {
  if (isHttpError(err)) {
    return {
      request: {
        endpoint: '[' + err.config.method + ']' + err.config.url,
        data: err.config.data,
      },
      response: {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
      },
    };
  }

  return err;
};
exports.beautifyError = beautifyError;

exports.handleError = function (req, res, err) {
  if (err instanceof CustomError.CustomError) {
    handleCustomError(req, res, err, err.httpCode);
    return;
  }

  let newErr = err;
  let message = null;
  if (isHttpError(err)) {
    newErr = beautifyError(err);
    message = `handleError - Error fetching: ${newErr.request.endpoint} - Response: [${newErr.response.status}] ${newErr.response.data}`;
  } else {
    message = `handleError : ${newErr.message}`;
  }

  errorLogger({
    message,
    eventType: EVENT_TYPE_NAVIGATION,
    error: newErr,
    data: getIOLoggingInfo(req, res),
  });

  res.status(500).send({ message });
};

exports.handleCronError = function ({ message, error }) {
  let newErr = error;
  let newMessage = '(' + ENVIRONMENT + ')' + message;

  if (isHttpError(error)) {
    newErr = beautifyError(error);
    newMessage = `handleCronError - Error fetching: ${message} ${newErr.request.endpoint} - Response: [${newErr.response.status}] ${newErr.response.data}`;
  }

  errorLogger({
    message: newMessage,
    eventType: EVENT_TYPE_CRON,
    error: newErr,
    notifyAdmin: true,
  });

  throw error;
};

const getIOLoggingInfo = function (req, res) {
  const { httpVersion, method, socket } = req;
  const { remoteAddress, remoteFamily } = socket;

  const requestHeaders = {
    originHeader: req.header('origin'),
    referer: req.header('referer'),
  };

  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  return {
    timestamp: Date.now(),

    request: {
      requestHeaders,

      method,
      remoteAddress,
      remoteFamily,
      fullUrl,
    },
  };
};

const handleCustomError = function (req, res, err, httpCode) {
  let retHttpCode = 500;
  if (httpCode) retHttpCode = httpCode;

  const message = `handleCustomError (${retHttpCode}) : ${err.code} - ${err.message}`;

  errorLogger({
    message,
    eventType: EVENT_TYPE_NAVIGATION,
    error: err,
    data: getIOLoggingInfo(req, res),
  });

  if (err.innerException) {
    errorLogger({
      message: message + '(InnerException)',
      eventType: EVENT_TYPE_NAVIGATION,
      error: err.innerException,
      data: getIOLoggingInfo(req, res),
    });
  }

  return res.status(retHttpCode).send({
    code: err.code,
    message: err.message,
    errorType: err.name,
    isCustomError: true,
  });
};

exports.getCustomError = function (err) {
  if (
    err &&
    err.isAxiosError &&
    err.response &&
    err.response.data &&
    err.response.data.isCustomError
  ) {
    return new CustomError.CustomError(
      err.response.data.code,
      err.response.status,
      err.response.data.message
    );
  }
  return null;
};

exports.handleCustomError = handleCustomError;
