const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  surveyName: Joi.string().min(2).max(100),
  surveyDescription: Joi.string().allow(''),

  typeformId: Joi.string(),

  surveyStatus: Joi.string(), // active | closed | stopped
  friendlyName: Joi.string(),
  responsesTarget: Joi.string(), // [self, relative]

  isAnonymous: Joi.bool(),
  isPublic: Joi.bool(),
  targetAudience: Joi.array().items(Joi.string()),
  linkUrl: Joi.string().allow('', null),

  endDate: Joi.date(),

  welcomeScreenTitle: Joi.string().allow('', null),
  welcomeScreenMessage: Joi.string().allow('', null),
  welcomeScreenImageUrl: Joi.string().allow('', null),
  welcomeScreenTemplate: Joi.string().allow('', null),

  finishScreenTitle: Joi.string().allow('', null),
  finishScreenMessage: Joi.string().allow('', null),
  finishScreenImageUrl: Joi.string().allow('', null),
  finishScreenTemplate: Joi.string().allow('', null),

  showProgress: Joi.bool(),
  randomizeQuestions: Joi.bool(),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = [
  'companyId',
  'surveyName',
  'friendlyName',
  'surveyStatus',
  'responsesTarget',
  'endDate',
  'typeformId',
];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
