import { clsx, type ClassValue } from "clsx";

/**
 * 合并className的工具函数，基于clsx
 * 用法：cn("class1", condition && "class2", { class3: true })
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
