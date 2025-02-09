// @ts-check
import { readFileByLine } from './fetch-text-by-line';
import { surgeDomainsetToClashDomainset, surgeRulesetToClashClassicalTextRuleset } from './clash';
import { traceAsync } from './trace-runner';
import picocolors from 'picocolors';

export async function compareAndWriteFile(linesA: string[], filePath: string) {
  let isEqual = true;
  const file = Bun.file(filePath);

  const linesALen = linesA.length;

  if (!(await file.exists())) {
    console.log(`${filePath} does not exists, writing...`);
    isEqual = false;
  } else if (linesALen === 0) {
    console.log(`Nothing to write to ${filePath}...`);
    isEqual = false;
  } else {
    isEqual = await traceAsync(
      picocolors.gray(`Comparing ${filePath}`),
      async () => {
        let index = 0;

        for await (const lineB of readFileByLine(file)) {
          const lineA = linesA[index];
          index++;

          if (lineA == null) {
            // The file becomes smaller
            return false;
          }

          if (lineA[0] === '#' && lineB[0] === '#') {
            continue;
          }
          if (
            lineA[0] === '/'
            && lineA[1] === '/'
            && lineA[3] === '#'
            && lineB[0] === '/'
            && lineB[1] === '/'
            && lineB[3] === '#'
          ) {
            continue;
          }

          if (lineA !== lineB) {
            return false;
          }
        }

        if (index !== linesALen) {
          // The file becomes larger
          return false;
        }

        return true;
      },
      picocolors.gray
    );
  }

  if (isEqual) {
    console.log(picocolors.gray(`Same Content, bail out writing: ${filePath}`));
    return;
  }

  await traceAsync(picocolors.gray(`Writing ${filePath}`), async () => {
    if (linesALen < 10000) {
      return Bun.write(file, `${linesA.join('\n')}\n`);
    }

    const writer = file.writer();

    for (let i = 0; i < linesALen; i++) {
      writer.write(linesA[i]);
      writer.write('\n');
    }

    return writer.end();
  }, picocolors.gray);
}

export const withBannerArray = (title: string, description: string[], date: Date, content: string[]) => {
  return [
    '#########################################',
    `# ${title}`,
    `# Last Updated: ${date.toISOString()}`,
    `# Size: ${content.length}`,
    ...description.map(line => (line ? `# ${line}` : '#')),
    '#########################################',
    ...content,
    '################## EOF ##################'
  ];
};

export const createRuleset = (
  title: string, description: string[], date: Date, content: string[],
  type: 'ruleset' | 'domainset', surgePath: string, clashPath: string
) => {
  const surgeContent = withBannerArray(title, description, date, content);

  let _clashContent;
  switch (type) {
    case 'domainset':
      _clashContent = surgeDomainsetToClashDomainset(content);
      break;
    case 'ruleset':
      _clashContent = surgeRulesetToClashClassicalTextRuleset(content);
      break;
    default:
      throw new TypeError(`Unknown type: ${type as any}`);
  }

  const clashContent = withBannerArray(title, description, date, _clashContent);

  return [
    compareAndWriteFile(surgeContent, surgePath),
    compareAndWriteFile(clashContent, clashPath)
  ];
};
