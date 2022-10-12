const Joi = require('joi');

const basicData = {
  externalContractId: Joi.string().allow(''),
  // rescueWalletAccount: Joi.string().allow(''),
  lenderCompany: Joi.string().allow(null).allow(''), // staffs ids || null si es automated

  //   startDate: Joi.date().allow(null),
  dueDate: Joi.date(), // fecha que se realiza la accion + hora que se realiza la acción (30 min dif para que el proceso corra cada 30 min)
  reminder: Joi.string().allow(null).allow(''), // 30 min before || 1 hour before || ...
  color: Joi.string(),
  notes: Joi.string().allow(''),
  attachments: Joi.any(),
};

const createSchema = Joi.object({
  ...basicData,

  //   // autoassigned on creation, not accepted onupdate
  userId: Joi.string(),
  contractAddress: Joi.string(),
  contractVersion: Joi.string().allow(''),
  contractSignerAddress: Joi.string(),
  contractDeployment: Joi.any(),
  contractName: Joi.string(),
  contractStatus: Joi.string(),
  contractError: Joi.string().allow(null).allow(''),
});

const updateSchema = Joi.object({
  ...basicData,
});

const configure = Joi.object({
  rescueWalletAccount: Joi.string().allow(''),
});

const requiredBaseFields = ['userId', 'contractAddress', 'contractSignerAddress', 'contractName'];

const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
  configure,
};

module.exports = schemas;
