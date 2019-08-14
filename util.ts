export function hasProp<T extends object> (
  obj: T,
  key: string | number | symbol
): key is keyof T {
  return {}.hasOwnProperty.call(obj, key);
}

export function forEach (
  sel: Cheerio,
  cb: ($el: Cheerio, i: number, el: CheerioElement) => void
) {
  // eslint-disable-next-line no-void
  sel.each((i, el) => void cb(sel.constructor(el), i, el));
}

/**
 * Filter unique. Pass to Array#filter
 */
export function unique<T> (value: T, index: number, self: T[]) {
  return self.indexOf(value) === index;
}
