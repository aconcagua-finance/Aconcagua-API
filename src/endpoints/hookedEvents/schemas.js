import { object, string, date, any, boolean } from 'joi';

const baseSchema = object({
  userId: string(),

  title: string().allow(''),
  message: string().allow(''),

  // template: Joi.array().items(Joi.string()), // todo michel
  eventType: string(), // ['completeForm', 'call', 'message', 'to-do', 'email'] >> : selectOption
  assignedTo: string().allow(null).allow(''), // staffs ids || null si es automated
  startDate: date(),
  dueDate: date(), // fecha que se realiza la accion + hora que se realiza la acción (30 min dif para que el proceso corra cada 30 min)
  reminder: string().allow(null).allow(''), // 30 min before || 1 hour before || ...
  repeat: any(), // todo michel
  automated: boolean(),
  priority: string().allow(null).allow(''),
  eventStatus: string(),
  color: string(),

  // reminderStatus: Joi.string(), // backend only

  withCalendar: boolean(),
  userCalendarEventId: string().allow(null).allow(''),
  notes: string().allow(''),
  attachments: any(),
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
