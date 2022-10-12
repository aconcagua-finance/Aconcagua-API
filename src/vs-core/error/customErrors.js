class CustomError extends Error {
  constructor(code, httpCode, message, innerException) {
    super(message);
    this.name = 'CustomError';
    this.processed = false;
    this.httpCode = httpCode || 500;
    this.code = code;
    this.innerException = innerException;
  }

  setProcessed(bl) {
    this.processed = bl;
  }

  setHttpCode(httpCode) {
    this.httpCode = httpCode;
  }
}

class HttpCancelError extends CustomError {
  constructor(innerException) {
    super('REQUEST_CANCELLED', 400, 'Se canceló el request', innerException);
    this.name = 'HttpCancelError';
  }
}

class TechnicalError extends CustomError {
  constructor(code, httpCode, message, innerException) {
    super(code, httpCode || 500, message, innerException);
    this.name = 'TechnicalError';
  }
}

class BusinessError extends CustomError {
  constructor(code, httpCode, message, innerException) {
    super(code, httpCode || 400, message, innerException);
    this.name = 'BusinessError';
  }
}

class NotFoundError extends CustomError {
  constructor(code, message, innerException) {
    super(code, 404, message, innerException);
  }
}
class DuplicatedResourceBusinessError extends BusinessError {
  constructor(code, message, innerException) {
    super(code, 409, message, innerException);
  }
}

exports.CustomError = CustomError;
exports.TechnicalError = TechnicalError;
exports.BusinessError = BusinessError;
exports.NotFoundError = NotFoundError;
exports.DuplicatedResourceBusinessError = DuplicatedResourceBusinessError;
exports.HttpCancelError = HttpCancelError;
