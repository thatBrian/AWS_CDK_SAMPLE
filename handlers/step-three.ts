import { Context } from "aws-lambda";

export const handler = (event: { firstNumber: number, secondNumber: number }, context: Context, callback: any) => {
  const { firstNumber, secondNumber } = event;

  callback(null, {
    firstNumber,
    secondNumber,
    subtract: firstNumber - secondNumber,
  });
};