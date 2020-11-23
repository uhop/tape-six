import puppeteer from 'puppeteer';

const main = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console[typeof console[msg.type()] == 'function' ? msg.type() : 'log'](msg.text()));
  page.on('error', e => console.error(e));

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

  await page.goto('http://localhost:3000/tests/web/test-simple.html');
};

main().then(
  () => console.log('Done.'),
  error => console.error('ERROR:', error)
);
