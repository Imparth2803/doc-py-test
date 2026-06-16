import { exec } from 'child_process';

export const extractTextWithPaddle =
  (
    filePath: string
  ): Promise<string> => {
    return new Promise(
      (resolve, reject) => {
        exec(
          `python3 src/services/ocr/paddleService.py "${filePath}"`,
          (
            error,
            stdout,
            stderr
          ) => {
            if (error) {
              console.error(stderr);

              reject(error);

              return;
            }

            try {
              const parsed =
                JSON.parse(stdout);

              resolve(parsed.text);
            } catch (err) {
              reject(err);
            }
          }
        );
      }
    );
  };