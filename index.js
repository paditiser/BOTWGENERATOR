const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

var brandIds = [];
var brandUrls = [];
var brandNames = [];
var brandDiscounts = [];

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
    consoleLogSpreadSheet(resource)

    sheets.spreadsheets.create({resource, fields: 'spreadsheetId'}, (err, spreadsheet) => {
        if (err) {
            // Handle error.
            console.log(err);
        } else {
            console.log(spreadsheet);
            console.log(`Spreadsheet ID: ${spreadsheet.data.spreadsheetId}`);

            //shares file
            drive.permissions.create({
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
          });
            
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
}

const getData = async () => {
    try {
        const body = await axios.get("https://www.iherb.com/c/brands-of-the-week");
        const $ = cheerio.load(body.data);

        var brandElements = $("img.bow-img", "#brands-of-week");

        brandElements.each((id, el) => {
            brandIds.push($(el).attr('data-brand-id'))
        });

        console.log(brandIds);

        for (const brandId of brandIds.values()) {
            const brandPageBody = await axios.get("https://www.iherb.com/c/brands-of-the-week?bids="+brandId);
            var brandPage = cheerio.load(brandPageBody.data);

            var productsElements = brandPage(".product-link", "#ProductsPage");
            brandUrls.push(productsElements[0].attribs['href'])
            var title = productsElements[0].attribs['title'];

            var brandName = title.slice(0, title.indexOf(','))
            brandNames.push(brandName)
            var discountElements = brandPage(".discount-in-cart", "#ProductsPage")

            var discountList = [];

            discountElements.each((id, el) => {
                var title = brandPage(el).attr('title');

                discountList.push(Number(title.slice(5, 7)));
            });

            brandDiscounts.push(findMode(discountList));
        }
        console.log(brandUrls)
       /* for (const brandUrl of brandUrls.values()) {
            const productPageBody = await axios.get(brandUrl);

            var productPage = cheerio.load(productPageBody.data);

            var brandNameElements = productPage("bdi", "#brand")
            brandNames.push((brandNameElements[1].children[0].data));
        }*/
        console.log("here")
        // Load client secrets from a local file.
        fs.readFile('credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Google Sheets API.
            console.log("no err")
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
    let d = new Date();

    let month = d.getMonth();
    let day = d.getDate();
    let year = d.getFullYear();

    var spreadSheet = createSpreadSheet("Brands of the Week " + (month + 1) + "/" + day + "/" + year, ["promotion_id", "product_applicability", "offer_type", "long_title", "promotion_effective_dates", "redemption_channel", "promotion_display_dates", "generic_redemption_code", "minimum_purchase_amount", "filter"]);

    for (let i = 0; i < brandIds.length; i++){
        d = new Date();
        month = d.getMonth();
        day = d.getDate();
        year = d.getFullYear();

        const promotion_id = brandIds[i] + d.getFullYear() + MONTHS[d.getMonth()] + "CA";
        const product_applicability = "SPECIFIC_PRODUCTS";
        const offer_type = "NO_CODE";
        const long_title = brandDiscounts[i]+"% Off Selected " +brandNames[i] + " Products";
        let promotion_effective_dates = year+ "-" + (month  + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00/";
        d.setDate(day + 7);
        month = d.getMonth();
        day = d.getDate();
        year = d.getFullYear();
        promotion_effective_dates +=  year+ "-" + (month + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00";
        const redemption_channel = "ONLINE";
        const promotion_display_dates = promotion_effective_dates;
        const generic_redemption_code = "";
        const minimum_purchase_amount = "";
        const filter = "";
        const row = createRowData([promotion_id, product_applicability, offer_type, long_title, promotion_effective_dates, redemption_channel, promotion_display_dates, generic_redemption_code, minimum_purchase_amount, filter])
        spreadSheet.sheets[0].data[0].rowData.push(row);

    }

    //empty rows
    const row = createRowData([])
    spreadSheet.sheets[0].data[0].rowData.push(row);
    spreadSheet.sheets[0].data[0].rowData.push(row);
    spreadSheet.sheets[0].data[0].rowData.push(row);
    
    //french
    for (let i = 0; i < brandIds.length; i++){
        d = new Date();
        month = d.getMonth();
        day = d.getDate();
        year = d.getFullYear();

        const promotion_id = brandIds[i] + d.getFullYear() + MONTHS[d.getMonth()] + "CA1";
        const product_applicability = "SPECIFIC_PRODUCTS";
        const offer_type = "NO_CODE";
        const long_title = brandDiscounts[i]+"% de Réduction sur Produits " +brandNames[i];
        let promotion_effective_dates = year+ "-" + (month  + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00/";
        d.setDate(day + 7);
        month = d.getMonth();
        day = d.getDate();
        year = d.getFullYear();
        promotion_effective_dates +=  year+ "-" + (month + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00";
        const redemption_channel = "ONLINE";
        const promotion_display_dates = promotion_effective_dates;
        const generic_redemption_code = "";
        const minimum_purchase_amount = "";
        const filter = "";
        const row = createRowData([promotion_id, product_applicability, offer_type, long_title, promotion_effective_dates, redemption_channel, promotion_display_dates, generic_redemption_code, minimum_purchase_amount, filter])
        spreadSheet.sheets[0].data[0].rowData.push(row);

    }


    // Empty Rows
    spreadSheet.sheets[0].data[0].rowData.push(row);
    spreadSheet.sheets[0].data[0].rowData.push(row);
    spreadSheet.sheets[0].data[0].rowData.push(row);
    
    //German
    for (let i = 0; i < brandIds.length; i++){
        d = new Date();
        month = d.getMonth();
        day = d.getDate();
        year = d.getFullYear();

        const promotion_id = brandIds[i] + d.getFullYear() + MONTHS[d.getMonth()] + "DE";
        const product_applicability = "SPECIFIC_PRODUCTS";
        const offer_type = "NO_CODE";
        const long_title = brandDiscounts[i]+"% auf ausgewählte " + brandNames[i] + " Produkte";
        let promotion_effective_dates = year+ "-" + (month  + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00/";
        d.setDate(day + 7);
        month = d.getMonth();
        day = d.getDate();
        year = d.getFullYear();
        promotion_effective_dates +=  year+ "-" + (month + 1).toString().padStart(2, '0') + "-" + day + "T10:00:00-00:00";
        const redemption_channel = "ONLINE";
        const promotion_display_dates = promotion_effective_dates;
        const generic_redemption_code = "";
        const minimum_purchase_amount = "";
        const filter = "";
        const row = createRowData([promotion_id, product_applicability, offer_type, long_title, promotion_effective_dates, redemption_channel, promotion_display_dates, generic_redemption_code, minimum_purchase_amount, filter])
        spreadSheet.sheets[0].data[0].rowData.push(row);

    }
    
    return spreadSheet;
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
    var spreadSheet = {
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

getData();
