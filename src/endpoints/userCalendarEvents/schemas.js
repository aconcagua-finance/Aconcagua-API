const Joi = require('joi');

const baseSchema = Joi.object({
  userId: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date(),
  summary: Joi.string(),
  description: Joi.string(),
  attendeesEmails: Joi.array().items(Joi.string()),
  calendarData: Joi.any(),
  userCalendarId: Joi.string(),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['userId'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
