const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const BOTW_URL = "https://www.iherb.com/c/brands-of-the-week";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const ACCOUNTS = [
  ["Germany", ["German"], "Gary", ["DE"]],
  ["India", ["English"], "Bruce", ["IN"]],
  ["United Kingdom", ["English"], "Gary", ["UK"]], 
  ["Canada", ["English", "French"], "Mahdi", ["CA", "CA1"]],
  ["Australia", ["English"], "Sean", ["AU"]],
  ["United States", ["English"], "Sean", ["US"]],
  ["France", ["French"], "Bruce", ["FR"]]
];

let SPREADSHEET_ID = null;
let _brandIds = [];
let _brandUrls = [];
let _brandNames = [];
let _brandDiscounts = [];

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 
                'https://www.googleapis.com/auth/drive', 
                'https://www.googleapis.com/auth/drive.file'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
  
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getNewToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    });
}

function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error while trying to retrieve access token', err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
        callback(oAuth2Client);
      });
    });
}

function exportData(auth) {
    const sheets = google.sheets({version: 'v4', auth});
    const drive = google.drive({version: 'v3', auth})

    const resource = createBrandsOfTheWeekBuildout();
    console.log("here")
    //consoleLogSpreadSheet(resource)

    const buildoutSpreadsheet = sheets.spreadsheets.create({resource, fields: 'spreadsheetId'}, (err, spreadsheet) => {
      if (err) {
        // Handle error.
        console.log(err);
      } else {
        console.log(spreadsheet);
        console.log(`Spreadsheet ID: ${spreadsheet.data.spreadsheetId}`);
        SPREADSHEET_ID = spreadsheet.data.spreadsheetId;
        //shares file
        /*drive.permissions.create({
            "fileId": spreadsheet.data.spreadsheetId,
            "resource": {
                "role": "writer",
                "type": "user",
                "emailAddress": "bruce@aditiser.com"
            }
        }).then((res) => {
            console.log(res);
        });

        drive.permissions.create({
          "fileId": spreadsheet.data.spreadsheetId,
          "resource": {
              "role": "writer",
              "type": "user",
              "emailAddress": "mahdi@aditiser.com"
          }
        }).then((res) => {
            console.log(res);
        });*/
        
        /*axios.post(`https://www.googleapis.com/drive/v3/files/${spreadsheet.data.spreadsheetId}/permissions?sendNotificationEmail=true`, {
            role: "writer",
            type: "user",
            emailAddress: "pfaraee@gmail.com"
        })
        .then((res) => {
            console.log(res);
        });*/
      }
    });

    //console.log(buildoutSpreadsheet);

}

async function getHTML(url) {
  const body = await axios.get(url);
  const $ = cheerio.load(body.data);
  return $;
}

function getBrandIds($) {
  let brandIds = [];
  const brandElements = $("img.bow-img", "#brands-of-week");

  brandElements.each((id, el) => {
      brandIds.push($(el).attr('data-brand-id'))
  });

  return brandIds;
}

function getBrandData(brandPage) {
  let brandUrls = [];
  // GET URL
  var productsElements = brandPage(".product-link", "#ProductsPage");
  brandUrls.push(productsElements[0].attribs['href'])
  _brandUrls.push(productsElements[0].attribs['href'])
  
  let brandNames = [];
  // GET BrandName
  var title = productsElements[0].attribs['title'];
  var brandName = title.slice(0, title.indexOf(','))
  brandNames.push(brandName)
  _brandNames.push(brandName)

  let brandDiscounts = [];
  // Get Discounts
  var discountElements = brandPage(".discount-in-cart", "#ProductsPage")
  var discountList = [];

  discountElements.each((id, el) => {
      var title = brandPage(el).attr('title');

      discountList.push(Number(title.slice(5, 7)));
  });

  brandDiscounts.push(findMode(discountList));
  _brandDiscounts.push(findMode(discountList));
}

const main = async () => {
  try {
    const body = await getHTML(BOTW_URL);
    _brandIds = getBrandIds(body);
       
    console.log("Root BOTW URL scraped")
    console.log(_brandIds);

    for (const brandId of _brandIds.values()) {
      const brandPage = await getHTML(`${BOTW_URL}?bids=${brandId}`);
      getBrandData(brandPage);
    }
    console.log("Brand data acquired")
    console.log(_brandUrls)

    // Load client secrets from a local file.
    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Sheets API.
        console.log("Client Authorized")
        authorize(JSON.parse(content), exportData);
    });
    
  } catch (e) {
    console.log(e)
  }
}
function consoleLogSpreadSheet(spreadSheet) {
    var rows = spreadSheet.sheets[0].data[0].rowData;
    for (const row of rows) {
      var rowText = "";

      for (const value of row.values) {
        rowText+= value.userEnteredValue.stringValue + " ";
      }

      console.log(rowText)
    }
  }


function createBrandsOfTheWeekBuildout() {
  const d = new Date();

  const month = d.getMonth();
  const day = d.getDate();
  const year = d.getFullYear();

  let sheets = [];

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];

    const accountName = account[0];
    const accountLanguages = account[1];
    const accountManager = account[2];
    const accountAbbreviations = account[3];

    

    let accountSheet = createSheet(accountName, ["promotion_id", "product_applicability", "offer_type", "long_title", "promotion_effective_dates", "redemption_channel", "promotion_display_dates", "generic_redemption_code", "minimum_purchase_amount", "filter"]);
    
    for (let j = 0; j  < accountLanguages.length; j++) {
      const accountLanguage = accountLanguages[j];
      const accountAbbreviation = accountAbbreviations[j];

      switch(accountLanguage) {
        case "German":

          for (let i = 0; i < _brandIds.length; i++){
            const promotion_id = _brandIds[i] + year + MONTHS[month] + accountAbbreviation;
            
            const product_applicability = "SPECIFIC_PRODUCTS";
            
            const offer_type = "NO_CODE";
            
            const long_title = `${_brandDiscounts[i]}% auf ausgewählte ${_brandNames[i]} Produkte`;
            
            let promotion_effective_dates_partials = year+ "-" + (month  + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00/";
            d.setDate(day + 7);
            const endMonth = d.getMonth();
            const endDay = d.getDate();
            const endYear = d.getFullYear();
            promotion_effective_dates_partials +=  endYear+ "-" + (endMonth + 1).toString().padStart(2, '0') + "-" + endDay + "T10:00:00-00:00";
            const promotion_effective_dates = promotion_effective_dates_partials;

            const redemption_channel = "ONLINE";
            
            const promotion_display_dates = promotion_effective_dates;
            
            const generic_redemption_code = "";
            
            const minimum_purchase_amount = "";
            
            const filter = "";
            
            const row = createRowData([promotion_id, product_applicability, offer_type, long_title, promotion_effective_dates, redemption_channel, promotion_display_dates, generic_redemption_code, minimum_purchase_amount, filter])
            accountSheet.data[0].rowData.push(row);
          }

          break;
        case "English":

          for (let i = 0; i < _brandIds.length; i++){
            const promotion_id = _brandIds[i] + year + MONTHS[month] + accountAbbreviation;
            
            const product_applicability = "SPECIFIC_PRODUCTS";
            
            const offer_type = "NO_CODE";
            
            const long_title = `${_brandDiscounts[i]}% Off Selected ${_brandNames[i]} Products`;
            
            let promotion_effective_dates_partials = year+ "-" + (month  + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00/";
            d.setDate(day + 7);
            const endMonth = d.getMonth();
            const endDay = d.getDate();
            const endYear = d.getFullYear();
            promotion_effective_dates_partials +=  endYear+ "-" + (endMonth + 1).toString().padStart(2, '0') + "-" + endDay + "T10:00:00-00:00";
            const promotion_effective_dates = promotion_effective_dates_partials;

            const redemption_channel = "ONLINE";
            
            const promotion_display_dates = promotion_effective_dates;
            
            const generic_redemption_code = "";
            
            const minimum_purchase_amount = "";
            
            const filter = "";
            
            const row = createRowData([promotion_id, product_applicability, offer_type, long_title, promotion_effective_dates, redemption_channel, promotion_display_dates, generic_redemption_code, minimum_purchase_amount, filter])
            accountSheet.data[0].rowData.push(row);
          }
          break;

        case "French":

          for (let i = 0; i < _brandIds.length; i++){
            const promotion_id = _brandIds[i] + year + MONTHS[month] + accountAbbreviation;
            
            const product_applicability = "SPECIFIC_PRODUCTS";
            
            const offer_type = "NO_CODE";
            
            const long_title = _brandDiscounts[i]+"% de Réduction sur Produits " +_brandNames[i];
            
            let promotion_effective_dates_partials = year+ "-" + (month  + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00/";
            d.setDate(day + 7);
            const endMonth = d.getMonth();
            const endDay = d.getDate();
            const endYear = d.getFullYear();
            promotion_effective_dates_partials +=  endYear+ "-" + (endMonth + 1).toString().padStart(2, '0') + "-" + endDay + "T10:00:00-00:00";
            const promotion_effective_dates = promotion_effective_dates_partials;

            const redemption_channel = "ONLINE";
            
            const promotion_display_dates = promotion_effective_dates;
            
            const generic_redemption_code = "";
            
            const minimum_purchase_amount = "";
            
            const filter = "";
            
            const row = createRowData([promotion_id, product_applicability, offer_type, long_title, promotion_effective_dates, redemption_channel, promotion_display_dates, generic_redemption_code, minimum_purchase_amount, filter])
            accountSheet.data[0].rowData.push(row);
    
        }
          break;

      }
      
      // Create empty space after language
      const row = createRowData([])
      accountSheet.data[0].rowData.push(row);
      accountSheet.data[0].rowData.push(row);
      accountSheet.data[0].rowData.push(row);

    }

    sheets.push(accountSheet)
  }

  const spreadsheet = createSpreadSheetWithSheets(`Brands of the Week ${day}/${month + 1}/${year}`, sheets)
  
  return spreadsheet
}

function findMode(array) {
    // This function starts by creating an object where the keys are each unique number of the array and the values are the amount of times that number appears in the array.
  
    let object = {}
  
    for (let i = 0; i < array.length; i++) {
      if (object[array[i]]) {
        // increment existing key's value
        object[array[i]] += 1
      } else {
        // make a new key and set its value to 1
        object[array[i]] = 1
      }
    }
  
    // assign a value guaranteed to be smaller than any number in the array
    let biggestValue = -1
    let biggestValuesKey = -1
  
    // finding the biggest value and its corresponding key
    Object.keys(object).forEach(key => {
      let value = object[key]
      if (value > biggestValue) {
        biggestValue = value
        biggestValuesKey = key
      }
    })
  
    return biggestValuesKey
  
}

  //Takes an array of Row Data
function createRowData(values){
    var rowData = {
        values: []
    }

    for (const value of values){
        rowData.values.push({
        userEnteredValue: {
            stringValue: value
        } 
        })
    }

    return rowData;
}

function createSpreadSheet(title, headers) {
  const spreadSheet = {
      properties: {
        title
      },
      sheets: [{
        data: [{
          //header row
          rowData: [createRowData(headers)]
        }]
      }]
    }

  return spreadSheet;
}

function createSpreadSheetWithSheets(title, sheets) {
  const spreadSheet = {
      properties: {
        title
      },
      sheets
    }

  return spreadSheet;
}

function createSheet(title, headers) {
  const sheet = {
    properties: {
      title
    },
    data: [{
      rowData: [createRowData(headers)]
    }]
  };

  return sheet;
}

main();
