import * as Audit from './audit';
import * as LoggerHelper from './helpers/loggerHelper';
import * as ErrorHelper from './helpers/errorHelper';

import { allowAnonymous, isAuthenticated } from './auth/authenticated';
import { isAuthorized, userIsGranted } from './auth/authorized';
import { EmailSender } from './email/emailSender';

const Auth = { allowAnonymous, isAuthenticated, isAuthorized, userIsGranted };

export { Audit, Auth, LoggerHelper, ErrorHelper, EmailSender };
