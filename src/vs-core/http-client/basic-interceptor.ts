/* eslint-disable handle-callback-err */
import { AxiosResponse } from 'axios';

import { Interceptor, InterceptorRecipe, Response } from './http-client-typings';

export const BasicResponseTransformInterceptor: Interceptor = [
  (response: AxiosResponse): Response<any> => ({
    status: response.status,
    data: response.data,
    errors: [],
  }),
  // (error) => {
  () => {
    return null;
  },
];

export const BasicInterceptors: InterceptorRecipe = {
  requestInterceptors: [],
  responseInterceptors: [BasicResponseTransformInterceptor],
};
