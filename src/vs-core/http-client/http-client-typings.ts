export interface Response<A> {
  status: number;
  data: A;
  errors?: Error[];
}

export type Interceptor = [(value: any) => any | Promise<any>, (error: any) => any];

export type InterceptorRecipe = {
  requestInterceptors: Interceptor[];
  responseInterceptors: Interceptor[];
};
