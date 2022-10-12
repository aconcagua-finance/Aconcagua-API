const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  surveyId: Joi.string().min(2).max(100),
  questionName: Joi.string().allow(''),

  order: Joi.number(),
  isOptional: Joi.bool(),
  title: Joi.string().allow(''),
  message: Joi.string().allow(''),

  questionType: Joi.string().allow(''),

  optionsLen: Joi.number(),
  optionsLeftLabel: Joi.string(),
  optionsMiddleLabel: Joi.string(),
  optionsRightLabel: Joi.string(),

  relatedAspects: Joi.any(),

  advancedOptions: Joi.any(),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['companyId', 'surveyId', 'questionType'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
