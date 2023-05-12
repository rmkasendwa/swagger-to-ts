export type JsonResponseContent = {
  'application/json': {
    schema: {
      $ref: string;
    };
  };
};

export type GenericResponseContent = {
  '*/*': {
    schema: {
      type: string;
    };
  };
};

export type ResponseContent = JsonResponseContent | GenericResponseContent;

export type Response = {
  content: ResponseContent;
  description?: string;
};

export type Responses = Record<number, Response>;
