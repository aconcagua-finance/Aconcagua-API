const Joi = require('joi');

const basicData = {
  firstName: Joi.string().min(2).max(100),
  lastName: Joi.string().min(2).max(100),
  nickname: Joi.string().allow(''),
  // email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net', 'io'] } }),

  phoneNumber: Joi.string().allow(''),
  identificationNumber: Joi.string(),
  gender: Joi.string().allow(null).allow(''),
  maritalStatus: Joi.string().allow(null).allow(''),
  birthDate: Joi.date().allow(null, ''),

  origin: Joi.string().allow(null).allow(''),

  company: Joi.string().allow(''),
  companyRol: Joi.string().allow(''),
  companyIdentificationNumber: Joi.string().allow(''),
  addressResidenceCountry: Joi.string().allow(null).allow(''),
  currentJobType: Joi.string().allow(null).allow(''),

  walletAccount: Joi.string().allow(null).allow(''),
  // lastTouchpoint: Joi.date().allow(null, ''), // no lo recibo. Se crea en el onCreate o onUpdate

  appUserStatus: Joi.string(),
};

const createSchema = Joi.object({
  ...basicData,
  email: Joi.string().email({ minDomainSegments: 2 }),

  // products: Joi.array().items(Joi.string()).allow(null),

  appRols: Joi.array().items(Joi.string()),
  // enterpriseRols: Joi.array()
  //   .items(
  //     Joi.object({
  //       companyId: Joi.string().required(),
  //       rols: Joi.array().items(Joi.string()),
  //     }).unknown(true)
  //   )
  //   .allow(null),

  // chargables: Joi.array().items(Joi.string()).allow(null),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const updateSchema = Joi.object({
  ...basicData,
  // email: Joi.string().email({ minDomainSegments: 2 }), // no puede editar el email

  appRols: Joi.array().items(Joi.string()),
  // enterpriseRols: Joi.array().items(
  //   Joi.object({
  //     companyId: Joi.string().required(),
  //     rols: Joi.array().items(Joi.string()),
  //   })
  // ),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const updateByStaff = Joi.object({
  ...basicData, // PENDIENTE DEFINICION, lo mismo que puede actualizar un admin puede actualizar un staff
  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const updateCurrentUser = Joi.object({
  walletAccount: Joi.string().allow(null).allow(''),
});

const createByStaff = Joi.object({
  ...basicData,
  email: Joi.string().email({ minDomainSegments: 2 }),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

// cualquier dato que se agregue acá tiene que agregarse tmb en las creaciones de:
// staff, companyClient, checkout
const requiredBaseFields = [
  'firstName',
  'lastName',
  'appUserStatus',
  'appRols',
  'identificationNumber',
  'phoneNumber',
];

const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
  updateByStaff,
  updateCurrentUser,
  createByStaff,
};

module.exports = schemas;
