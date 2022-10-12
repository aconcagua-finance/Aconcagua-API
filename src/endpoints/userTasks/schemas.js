const Joi = require('joi');

const baseSchema = Joi.object({
  userId: Joi.string(),
  tasks: Joi.array().items(
    Joi.object({
      taskId: Joi.string().allow(''),
      status: Joi.string(),
      rate: Joi.number(),
      notes: Joi.string().allow(''),
    })
  ),
});

const upsertSchema = Joi.object({
  userId: Joi.string(),

  tasks: Joi.array()
    .items(
      Joi.object({
        taskId: Joi.string().allow(''),
        status: Joi.string(),
        rate: Joi.number(),
        notes: Joi.string().allow(''),
      })
    )
    .required(),
});

const requiredBaseFields = ['userId', 'tasks'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
  upsert: upsertSchema,
};

module.exports = schemas;
