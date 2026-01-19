import process from 'node:process';
import {chromium} from 'playwright';

const main = async () => {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  const page = await browser.newPage();

  page.on('console', msg =>
    console[typeof console[msg.type()] == 'function' ? msg.type() : 'log'](msg.text())
  );
  page.on('pageerror', e => console.error(e));

  await page.exposeFunction('__tape6_reportResults', async text => {
    await browser.close();
    switch (text) {
      case 'success':
        process.exit(0);
        break;
      case 'failure':
        process.exit(1);
        break;
    }
  });

  await page.goto('http://localhost:3000/tests/web/test-simple.html?flags=M');
};

main().then(
  () => console.log('Done.'),
  error => console.error('ERROR:', error)
);
