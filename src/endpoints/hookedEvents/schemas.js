const Joi = require('joi');

const baseSchema = Joi.object({
  userId: Joi.string(),

  title: Joi.string().allow(''),
  message: Joi.string().allow(''),

  // template: Joi.array().items(Joi.string()), // todo michel
  eventType: Joi.string(), // ['completeForm', 'call', 'message', 'to-do', 'email'] >> : selectOption
  assignedTo: Joi.string().allow(null).allow(''), // staffs ids || null si es automated
  startDate: Joi.date(),
  dueDate: Joi.date(), // fecha que se realiza la accion + hora que se realiza la acción (30 min dif para que el proceso corra cada 30 min)
  reminder: Joi.string().allow(null).allow(''), // 30 min before || 1 hour before || ...
  repeat: Joi.any(), // todo michel
  automated: Joi.boolean(),
  priority: Joi.string().allow(null).allow(''),
  eventStatus: Joi.string(),
  color: Joi.string(),

  // reminderStatus: Joi.string(), // backend only

  withCalendar: Joi.boolean(),
  userCalendarEventId: Joi.string().allow(null).allow(''),
  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['userId', 'title', 'eventType', 'startDate', 'dueDate'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

// - userId >> targetUserId
// - title: string
// - message: string
// - template: selectOption templates
// - eventType: ['completeForm', 'call', 'message', 'to-do', 'email'] >> : selectOption
// - assignedTo >> Array string (ids staff)
// - startDate: date
// - dueDate: date >> fecha que se realiza la accion + hora que se realiza la acción (30 min dif para que el proceso corra cada 30 min)
// - reminder: selectOption
// - repeat: obj
// - automated: bool
// - priority: selectOption priorities
// - eventStatus : selectOption hookedEventsStatusOptions
// - reminderStatus: selectOption hookedEventsReminderStatusOptions

export default schemas;
