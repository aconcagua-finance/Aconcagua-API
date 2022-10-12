/* eslint-disable no-console */

const httpContext = require('express-http-context');
const admin = require('firebase-admin');

exports.isAuthenticated = async function (req, res, next) {
  const { authorization } = req.headers;

  if (!authorization) {
    console.error('Unauthorized (1), no authorization header');
    return res.status(401).send({ message: 'Unauthorized (1)' });
  }

  if (!authorization.startsWith('Bearer')) {
    console.error('Unauthorized (2), no Bearer token');
    return res.status(401).send({ message: 'Unauthorized (2)' });
  }
  const split = authorization.split('Bearer ');
  if (split.length !== 2) {
    console.error('Unauthorized (3), bad format Bearer token');
    return res.status(401).send({ message: 'Unauthorized (3)' });
  }
  const token = split[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // console.log("decodedToken", JSON.stringify(decodedToken));

    // enterpriseRols[ {companyId, rols: [ENTERPRISE_SALES, ENTERPRISE_ADMIN]}]
    // appRols: decodedToken.appRols, // [APP_ADMIN]

    res.locals = {
      ...res.locals,
      userId: decodedToken.uid,
      enterpriseRols: decodedToken.enterpriseRols,
      appRols: decodedToken.appRols,
      email: decodedToken.email,
    };

    // Http context only access req
    httpContext.set('locals', res.locals);
    httpContext.set('request-authorization-header', { authorization });

    return next();
  } catch (err) {
    console.error(`${err.code} -  ${err.message}`);
    return res.status(401).send({ message: 'Unauthorized (4)' });
  }
};

exports.allowAnonymous = async function (req, res, next) {
  const { authorization } = req.headers;

  if (!authorization) return next();

  if (!authorization.startsWith('Bearer')) return next();

  const split = authorization.split('Bearer ');
  if (split.length !== 2) return next();

  const token = split[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // console.log("decodedToken", JSON.stringify(decodedToken));

    // enterpriseRols[ {companyId, rols: [ENTERPRISE_SALES, ENTERPRISE_ADMIN]}]
    // appRols: decodedToken.appRols, // [APP_ADMIN]

    res.locals = {
      ...res.locals,
      userId: decodedToken.uid,
      enterpriseRols: decodedToken.enterpriseRols,
      appRols: decodedToken.appRols,
      email: decodedToken.email,
      status: decodedToken.status,
    };

    // Http context only access req
    httpContext.set('locals', res.locals);
    httpContext.set('request-authorization-header', { authorization });

    return next();
  } catch (err) {
    console.error(`${err.code} -  ${err.message}`);
    return res.status(401).send({ message: 'Unauthorized (4)' });
  }
};
