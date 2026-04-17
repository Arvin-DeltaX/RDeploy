export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

export interface AxiosErrorLike {
  response?: { data?: { error?: string; missingKeys?: string[] } };
}
