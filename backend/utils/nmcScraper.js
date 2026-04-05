const { verifyNMCDoctor } = require('./nmcValidator');

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (err) {
  puppeteer = null;
}

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const buildDoctorData = (nmcNumber, doctorName) => ({
  name: doctorName,
  state: 'Unknown',
  registrationYear: 'Unknown',
  specialization: 'Unknown',
  status: 'active',
  nmcNumber
});

const verifyNMCDoctorWithPuppeteer = async (nmcNumber, doctorName) => {
  if (!process.env.NMC_PUPPETEER_ENABLED || process.env.NMC_PUPPETEER_ENABLED !== 'true') {
    return { valid: false, error: 'Puppeteer verification disabled' };
  }

  if (!puppeteer) {
    return { valid: false, error: 'Puppeteer is not installed' };
  }

  const registryUrl =
    process.env.NMC_REGISTRY_URL ||
    'https://www.nmc.org.in/information-desk/indian-medical-register/';
  const searchInputSelector = process.env.NMC_SEARCH_INPUT_SELECTOR || '#doctorRegdNo';
  const doctorNameSelector = process.env.NMC_DOCTOR_NAME_SELECTOR || '#doctorName';
  const searchSubmitSelector = process.env.NMC_SEARCH_SUBMIT_SELECTOR || '#doctor_advance_Details';
  const resultContainerSelector =
    process.env.NMC_RESULT_CONTAINER_SELECTOR || '#doct_info5_wrapper';
  const yearDropdownSelector = process.env.NMC_YEAR_DROPDOWN_SELECTOR;
  const yearOptionSelector = process.env.NMC_YEAR_OPTION_SELECTOR;

  if (!registryUrl || !searchInputSelector || !searchSubmitSelector || !resultContainerSelector) {
    return { valid: false, error: 'NMC registry selectors are not configured' };
  }

  const username = process.env.NMC_USERNAME;
  const password = process.env.NMC_PASSWORD;
  const loginUrl = process.env.NMC_LOGIN_URL;
  const usernameSelector = process.env.NMC_USERNAME_SELECTOR;
  const passwordSelector = process.env.NMC_PASSWORD_SELECTOR;
  const loginSubmitSelector = process.env.NMC_LOGIN_SUBMIT_SELECTOR;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    if (loginUrl && username && password && usernameSelector && passwordSelector && loginSubmitSelector) {
      await page.goto(loginUrl, { waitUntil: 'networkidle2' });
      await page.waitForSelector(usernameSelector, { timeout: 15000 });
      await page.type(usernameSelector, username, { delay: 10 });
      await page.type(passwordSelector, password, { delay: 10 });
      await Promise.all([
        page.click(loginSubmitSelector),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    }

    await page.goto(registryUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector(searchInputSelector, { timeout: 15000 });
    await page.click(searchInputSelector, { clickCount: 3 });
    await page.type(searchInputSelector, nmcNumber, { delay: 10 });

    if (doctorNameSelector) {
      await page.waitForSelector(doctorNameSelector, { timeout: 15000 });
      await page.click(doctorNameSelector, { clickCount: 3 });
      await page.type(doctorNameSelector, doctorName, { delay: 10 });
    }

    if (yearDropdownSelector && yearOptionSelector) {
      await page.waitForSelector(yearDropdownSelector, { timeout: 15000 });
      await page.click(yearDropdownSelector);
      await page.waitForSelector(yearOptionSelector, { timeout: 15000 });
      await page.click(yearOptionSelector);
    }
    await Promise.all([
      page.click(searchSubmitSelector),
      page.waitForTimeout(1500)
    ]);

    await page.waitForSelector(resultContainerSelector, { timeout: 15000 });
    const resultText = await page.$eval(resultContainerSelector, (el) => el.innerText || '');

    const normalizedResult = normalizeText(resultText);
    const normalizedName = normalizeText(doctorName);
    const normalizedNumber = normalizeText(nmcNumber);

    if (normalizedResult.includes(normalizedNumber) && normalizedResult.includes(normalizedName)) {
      return { valid: true, doctorData: buildDoctorData(nmcNumber, doctorName) };
    }

    return { valid: false, error: 'No matching doctor record found in registry results' };
  } catch (error) {
    return { valid: false, error: 'NMC Puppeteer verification failed: ' + error.message };
  } finally {
    await browser.close();
  }
};

/**
 * NMC Doctor Verification (Mock)
 * Previously used Puppeteer scraping but now uses mock registry for reliability
 * In production, this would connect to actual NMC API
 */
const verifyNMCDoctorWithFallback = async (nmcNumber, doctorName) => {
  try {
    const puppeteerResult = await verifyNMCDoctorWithPuppeteer(nmcNumber, doctorName);
    if (puppeteerResult.valid) {
      return {
        valid: true,
        doctorData: puppeteerResult.doctorData,
        verified: true,
        method: 'puppeteer_registry',
        timestamp: new Date().toISOString()
      };
    }

    return {
      valid: false,
      error: puppeteerResult.error || 'NMC verification failed',
      verified: false,
      method: 'puppeteer_registry',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('NMC verification error:', error);
    return {
      valid: false,
      error: 'NMC verification failed: ' + error.message,
      verified: false,
      method: 'mock_registry',
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  verifyNMCDoctorWithFallback
};
