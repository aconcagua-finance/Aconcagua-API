// import * as Config from '../config';

export type LoggerConfigProps = {
  debug: boolean;
  info: boolean;
};

export class Logger {
  static defaultProps: LoggerConfigProps = {
    debug: false,
    info: true,
  };

  static configure(props: LoggerConfigProps) {
    Logger.defaultProps = { ...Logger.defaultProps, ...props };
  }

  static debug(...args: string[]) {
    if (!Logger.defaultProps.debug) return;
    // eslint-disable-next-line no-console
    console.debug(...args);
  }

  static info(...args: any[]) {
    if (!Logger.defaultProps.info) return;
    // eslint-disable-next-line no-console
    console.info(...args);
  }

  static warn(...args: any[]) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }

  static error(...args: any[]) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
}
