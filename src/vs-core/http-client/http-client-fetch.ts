import axios, { AxiosRequestConfig, Canceler, Method } from 'axios';

import { CustomError, HttpCancelError } from '../error/customErrors';
import { Logger } from '../logger';

import { BasicInterceptors } from './basic-interceptor';
import { Interceptor, InterceptorRecipe, Response } from './http-client-typings';

interface Options extends AxiosRequestConfig {
  cancel?: (cancel: Canceler) => void;
  requestInterceptors?: Interceptor[] | null;
  responseInterceptors?: Interceptor[] | null;
  interceptorsRecipe?: InterceptorRecipe;
  api?: string;
  cache?: boolean;
  cacheMinutes?: number;
  method?: Method;
}

const fetch = async (
  url: string,
  {
    interceptorsRecipe = BasicInterceptors,
    cancel,
    requestInterceptors = null,
    responseInterceptors = null,
    headers = {},
    method,
    params = null,
    // cache = null,
    // cacheMinutes = 30,
    ...otherOptions
  }: Options = {}
): Promise<Response<any>> => {
  const instance = axios.create();

  (requestInterceptors || interceptorsRecipe.requestInterceptors).forEach(([resolve, reject]) => {
    instance.interceptors.request.use(resolve, reject);
  });

  (responseInterceptors || interceptorsRecipe.responseInterceptors).forEach(([resolve, reject]) => {
    instance.interceptors.response.use(resolve, reject);
  });

  try {
    Logger.debug(`HttpClient Invocando: [${method}] ${url}`);
    const response = await instance.request({
      url,
      headers,
      // eslint-disable-next-line import/no-named-as-default-member
      cancelToken: cancel ? new axios.CancelToken(cancel) : undefined,
      method,
      params,
      ...otherOptions,
    });

    // if (cache && method === "get") {
    //   return lscache.set(JSON.stringify([url, params]), response, cacheMinutes);
    // }

    Logger.debug(`HttpClient Resultado invocación OK: [${method}] ${url}`);

    return response;
  } catch (err) {
    if (axios.isCancel(err)) {
      Logger.debug('HttpClient: request cancelled');

      throw new HttpCancelError(err);
    } else {
      if (
        err &&
        err.isAxiosError &&
        err.response &&
        err.response.data &&
        err.response.data.isCustomError
      ) {
        const customError = new CustomError(
          err.response.data.code,
          err.response.status,
          err.response.data.message,
          err
        );
        // Logger.debug(
        //   `HttpClient: CustomError: ` + " [" + method + "] " + url,
        //   customError
        // );

        throw customError;
      }

      Logger.debug(
        `${'HttpClient: something went wrong when trying to fetch.' + ' ['}${method}] ${url}`
      );
      throw err;
    }
  }
};

const makeMethod =
  (method: Method) =>
  (url: any, options: Options = {}) =>
    fetch(url, {
      ...options,
      method,
    });

export const httpGet = makeMethod('get');

export const httpPatch = makeMethod('patch');

export const httpPost = makeMethod('post');

export const httpPut = makeMethod('put');

export const httpDel = makeMethod('delete');
