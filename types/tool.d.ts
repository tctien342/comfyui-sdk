export type KeysUnion<T, Cache extends string = ""> =
  /**
   * If T is no more an object, it means that this call
   * is last in a recursion, hence we need to return
   * our Cache (accumulator)
   */
  T extends PropertyKey
    ? Cache
    : /**
       * If T is an object, iterate through each key
       */
      {
        [P in keyof T]: P extends string
          ? /**
             * If Cache is an empty string, it means that this call is first,
             * because default value of Cache is empty string
             */
            Cache extends ""
            ? /**
               * Since Cache is still empty, no need to use it now
               * Just call KeysUnion recursively with first property as an argument for Cache
               */
              KeysUnion<T[P], `${P}`>
            : /**
               * Since Cache is not empty, we need to unionize it with property
               * and call KeysUnion recursively again,
               * In such way every iteration we apply to Cache new property with dot
               */
              Cache | KeysUnion<T[P], `${Cache}.${P}`>
          : never;
      }[keyof T];
