const stockListElement = document.getElementById("stock-list");
const GREEN_COLOR = "#50f291";
const RED_COLOR = "rgb(246, 57, 57)";
const WHITE_COLOR = "#FFFFFF";
const BTN_COLOR = "rgba(87, 102, 202, 0.447)";
const BTN_COLOR_HOVER = "rgba(19, 35, 142, 0.447)";
let chartElement;
let periodListID = "period-list";
let periodsDivElement = document.getElementById(periodListID);
const stockInfoElement = document.getElementById("stock-info");
//used to store the current period displaying in the chart. 
//this button will be disabled, and will be enabled when some 
//other button is selected.  
let periodDisplaying;

// hoverline section for char plugin - to draw line from 
// bottom to the point
const hoverline = {
    id: 'hoverline',
    afterDatasetsDraw(chart, args, plugins) {
        const { ctx, tooltip, chartArea: { top, bottom, left, right, width, height }, scales: { x, y } } = chart;
        if (tooltip._active.length > 0) {
            let xCoor = x.getPixelForValue(tooltip.dataPoints[0].dataIndex);
            let yCoor = y.getPixelForValue(tooltip.dataPoints[0].parsed.y);
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#FFFFFF';
            ctx.moveTo(xCoor, yCoor);
            ctx.lineTo(xCoor, bottom - 10);
            ctx.stroke();
            ctx.closePath();
        }
    }
};

//custom plugin to display -> x-label of the hovered/selected point
const customLabelsPlugin = {
    id: 'customLabelsPlugin',
    afterDatasetsDraw(chart) {
        const { ctx, data, tooltip, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
        chart.getActiveElements().forEach((active) => {
            let xCoor = x.getPixelForValue(tooltip.dataPoints[0].dataIndex);
            const value = data.datasets[active.datasetIndex].data[active.index];
            const fontSize = '80';
            ctx.save();
            ctx.font = `bolder ${fontSize} sans-serif`;
            ctx.fillStyle = WHITE_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(tooltip.dataPoints[0].label, xCoor, bottom - 10);
        });

    }
};

//fetches chart data using external API and then transforms the json for further use
async function getChartData(stockSymbol) {
    let stockData = await fetch("https://stocks3.onrender.com/api/stocks/getstocksdata");
    if (!stockData.ok)
        throw new Error("Api call fail");
    let stockDataJson = await stockData.json();
    return stockDataJson["stocksData"][0][stockSymbol];
}

//fetches the summary of the given stock using Stock symbol as a parameter from an external api
async function getSummary(stockSymbol) {
    let stockSummary = await fetch("https://stocks3.onrender.com/api/stocks/getstocksprofiledata");
    if (!stockSummary.ok)
        throw new Error("Api call fail");
    let stockSummaryJson = await stockSummary.json();
    // find stockSummaryJson for the given id
    return stockSummaryJson["stocksProfileData"][0][stockSymbol];
}

//returns all the stocklist data from external api to display in the side section
async function fetchAllStocks() {
    let stockData = await fetch("https://stocks3.onrender.com/api/stocks/getstockstatsdata");
    if (!stockData.ok)
        throw new Error("Api call fail");
    let stockDataJson = await stockData.json();
    return stockDataJson.stocksStatsData[0];
}

//displays the stock details for a particular stock including rendering
//its chart, showing its summary and other details
async function displayStockDetails(stockSymbol) {
    await displayChart(stockSymbol).then(resp => { addButtonsUnderChart(stockSymbol, resp) });
    let stockSummary = await getSummary(stockSymbol);
    await fetchAllStocks().then(resp => displaySummary(stockSymbol, stockSummary, resp[stockSymbol]));
}

//wrapper funtion to fill html element for displaying stock data
function displaySummary(stockSymbol, stockSummary, stockBookValues){ 
    let stockSymbolElement = stockInfoElement.querySelector("#stock-symbol"); 
    let bookValue = stockInfoElement.querySelector("#book-val"); 
    let perChange = stockInfoElement.querySelector("#per-change"); 
    let companySummary = stockInfoElement.querySelector("#company-summary"); 

    stockSymbolElement.textContent = stockSymbol; 
    bookValue.textContent = `$${stockBookValues.bookValue}`; 
    perChange.textContent = `${stockBookValues.profit}%`; 
    perChange.className = stockBookValues.profit > 0 ? "green" : "red";
    companySummary.textContent = stockSummary.summary;  
}

//wrapper function to add the buttons in the chart and add event listeners as well. 
function addButtonsUnderChart(stockSymbol, chartData) {
    removeChilds(periodsDivElement);
    periodDisplaying = undefined;
    Object.keys(chartData).forEach(key => {
        if (key != "_id") {
            let periodBtn = document.createElement("button");
            periodBtn.textContent = key;
            if (key == "1mo") {
                periodBtn.disabled = true;
                periodDisplaying = periodBtn;
                periodBtn.style.backgroundColor = BTN_COLOR_HOVER;
            }
            periodBtn.addEventListener("click", () => {
                if (periodDisplaying) {
                    periodDisplaying.disabled = false;
                    periodDisplaying.style.backgroundColor = BTN_COLOR;
                }
                periodDisplaying = periodBtn;
                periodDisplaying.disabled = true;
                periodBtn.style.backgroundColor = BTN_COLOR_HOVER;
                displayChart(stockSymbol, key);
            });
            periodsDivElement.append(periodBtn);
        }
    });

}

//displays chart for a given stockSymbol and period
async function displayChart(stockSymbol, period = "1mo") {
    let chartData = await getChartData(stockSymbol);
    populateChartData(stockSymbol, chartData, period);
    return chartData;
}

//populates the chart data using Chart.js new Chart element
//the chartElement is destroyed first if it already exists
function populateChartData(stockSymbol, stockData, period) {
    if (chartElement)
        chartElement.destroy();
    let xValues = stockData[period].timeStamp;
    xValues = xValues.map(timestamp => {
        let dt = new Date(timestamp * 1000).toLocaleString()
        return dt.slice(0, dt.indexOf(','));
    });
    let yValues = stockData[period].value;
    let maxValue = Math.max(...yValues);
    let minValue = Math.min(...yValues);
    let minIndex, maxIndex;
    yValues.forEach((value, index) => {
        if (value == maxValue)
            maxIndex = index;

        if (value == minValue)
            minIndex = index;
    });
    chartElement = new Chart("myChart", {
        type: 'line',
        data: {
            labels: xValues,
            datasets: [{
                // label: '',
                borderColor: GREEN_COLOR,
                data: yValues,
                borderWidth: 1,
                pointBorderColor: GREEN_COLOR,
                pointBackgroundColor: GREEN_COLOR,
                pointRadius: function (context) {
                    let index = context.dataIndex;
                    // console.log(`index : ${index}, minIndex : ${minIndex}, maxIndex : ${maxIndex}`);
                    if (index == minIndex || index == maxIndex)
                        return 5;
                    else
                        return 0;
                }
            }]
        },
        options: {
            scales: {
                x: {
                    ticks: {
                        display: false
                    },

                },
                y: {
                    suggestedMin: minValue - 10,
                    ticks: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    displayColors: true,

                    callbacks: {
                        title: function (tooltipItem) {
                            return '';
                        },
                        label: function (tooltipItem) {
                            return `${stockSymbol}:$${tooltipItem.formattedValue}`;
                        }
                    }
                }

            }
        },
        plugins: [
            hoverline, customLabelsPlugin
        ]
    });
    return { xValues, yValues };
}

//used to display all the stock data is returned by fetchAllStocks in the html page.
function prepareAllStockData(stockDatas) {
    removeChilds(stockListElement);
    Object.keys(stockDatas).forEach(key => {
        if (key != "_id")
            prepareStockData(key, stockDatas[key]);
    });
}

//displays a single stock element data in the side section 
function prepareStockData(stockSymbol, stockData) {
    let divElement = document.createElement("div");
    let stockSymbolElement = document.createElement("button");
    stockSymbolElement.className = "stock-btn";
    stockSymbolElement.setAttribute("id", stockSymbol);
    stockSymbolElement.classList.add("stock-btn");
    stockSymbolElement.addEventListener("click", async (e) => {
        await displayStockDetails(e.target.id);
    });
    let bookValueElement = document.createElement("span");
    let profitLossElement = document.createElement("span");
    stockSymbolElement.textContent = stockSymbol;
    bookValueElement.textContent = `$${(stockData.bookValue).toFixed(3)}`;
    bookValueElement.className = "white";
    profitLossElement.textContent = `${(stockData.profit).toFixed(2)}%`;
    profitLossElement.className = stockData.profit > 0 ? "green" : "red";
    divElement.append(stockSymbolElement, bookValueElement, profitLossElement);
    stockListElement.append(divElement);
}

//helper function to remove child elements of any given html element.
function removeChilds(htmlElement) {
    let lastChild = htmlElement.lastElementChild;
    while (lastChild) {
        lastChild.remove();
        lastChild = htmlElement.lastElementChild;
    }
}

fetchAllStocks().then(stockDatas => prepareAllStockData(stockDatas));