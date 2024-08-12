export type FixArr<T> = T extends readonly any[]
  ? Omit<T, Exclude<keyof any[], number>>
  : T;
export type DropInitDot<T> = T extends `.${infer U}` ? U : T;
export type _DeepKeys<T> = T extends object
  ? {
      [K in (string | number) & keyof T]: `${`.${K}`}${
        | ""
        | _DeepKeys<FixArr<T[K]>>}`;
    }[(string | number) & keyof T]
  : never;

export type DeepKeys<T> = DropInitDot<_DeepKeys<FixArr<T>>>;

export type Simplify<T> = { [K in keyof T]: T[K] } & {};
