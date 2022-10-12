const Joi = require('joi');

const schema = Joi.object({
  state: Joi.number().integer().min(0).max(100).required(),
  createdAt: Joi.any().required(),
  updatedAt: Joi.any().required(),
  createdBy: Joi.string().required(),
  updatedBy: Joi.string().required(),

  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().min(2).max(1000).required(),
  images: Joi.array().items(
    Joi.object({
      type: Joi.string(),
      isPublic: Joi.boolean(),
      publicUrl: Joi.string(),
      storage: Joi.object({ bucketName: Joi.string(), destination: Joi.string() }),
    })
  ),

  relevant: Joi.boolean(),
});

// const schema = Joi.array().items(
//     Joi.object({
//       a: Joi.string(),
//       b: Joi.number()
//     })
//   ).has(Joi.object({ a: Joi.string().valid('a'), b: Joi.number() }))

module.exports = schema;
