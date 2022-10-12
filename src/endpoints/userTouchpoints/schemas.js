const Joi = require('joi');

const baseSchema = Joi.object({
  userId: Joi.string(),

  touchpointDate: Joi.date(),

  channelType: Joi.string(),
  message: Joi.string().allow(''),

  staff: Joi.string().allow(null).allow(''),

  recordingLink: Joi.string().allow(''),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['userId', 'channelType', 'message', 'touchpointDate'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
