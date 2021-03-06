const axios = require('axios');
const logger = require('../../../utils/logger');
const querystring = require('querystring');

// a map of Mexican states with the corresponding IDs gob.mx uses server-side
const stateIDs = [
	{ state: 'aguascalientes', id: '01' },
	{ state: 'baja california', id: '02' },
	{ state: 'baja california sur', id: '03' },
	{ state: 'campeche', id: '04' },
	{ state: 'coahuila', id: '05' },
	{ state: 'colima', id: '06' },
	{ state: 'chiapas', id: '07' },
	{ state: 'chihuahua', id: '08' },
	{ state: 'ciudad de mexico', id: '09' },
	{ state: 'durango', id: '10' },
	{ state: 'guanajuato', id: '11' },
	{ state: 'guerrero', id: '12' },
	{ state: 'hidalgo', id: '13' },
	{ state: 'jalisco', id: '14' },
	{ state: 'estado de mexico', id: '15' },
	{ state: 'michoacan', id: '16' },
	{ state: 'morelos', id: '17' },
	{ state: 'nayarit', id: '18' },
	{ state: 'nuevo leon', id: '19' },
	{ state: 'oaxaca', id: '20' },
	{ state: 'puebla', id: '21' },
	{ state: 'queretaro', id: '22' },
	{ state: 'quintana roo', id: '23' },
	{ state: 'san luis potosi', id: '24' },
	{ state: 'sinaloa', id: '25' },
	{ state: 'sonora', id: '26' },
	{ state: 'tabasco', id: '27' },
	{ state: 'tamaulipas', id: '28' },
	{ state: 'tlaxcala', id: '29' },
	{ state: 'veracruz', id: '30' },
	{ state: 'yucatan', id: '31' },
	{ state: 'zacatecas', id: '32' }
];

// an object to initialize the FormData object that must be sent with the requests
const formData = {
	nationalCasesToday: querystring.stringify({ cve: '000', nom: 'nacional', sPatType: 'Confirmados' }),
	nationalDeathsToday: querystring.stringify({ cve: '000', nom: 'nacional', sPatType: 'Defunciones' }),
	stateCases: querystring.stringify({ cve: '', nom: '', sPatType: 'Confirmados' }),
	stateDeaths: querystring.stringify({ cve: '', nom: '', sPatType: 'Defunciones' }),
	stateSuspects: querystring.stringify({ cve: '', nom: '', sPatType: 'Sospechosos' }),
	stateNegatives: querystring.stringify({ cve: '', nom: '', sPatType: 'Negativos' }),
	nationalCaseData: querystring.stringify({ cve: '000', nom: '', sPatType: '' })
};

/**
 * Gets the numerical value of an DOM node's innerHTML
 * @param {string} res A response body string
 * @param {string} 	identifier A unique class or ID whose innerHTML value to grab
 * @returns {number}	The innerHTML value
 */
const getInnerHTML = (res, identifier) => parseInt(res.substring(res.indexOf(identifier), res.indexOf(identifier) + 35).split('(')[1].split(')')[0]);

/**
 * Parse and filter national data response
 * @param	{string} res	The response body string to extract data from
 * @returns {Object}	National data for Mexico
 */
const getNationalToday = (res) => JSON.parse(res.substring(res.lastIndexOf('['), res.lastIndexOf(']') + 1)).pop();

/**
 * Creates and returns an object containing data for each tracked Mexican state
 * @param	{string} res	The response body string to extract data from
 * @returns {Object}	Individual state data for Mexico
 */
const getState = (res) => {
	const stateValues = {};
	stateIDs.forEach(state => {
		const target = `Total['${state.id}']`;
		const value = parseInt(res.substring(res.indexOf(target), res.indexOf(target) + 18).split(';')[0].split('=')[1]);
		stateValues[state.state] = value;
	});
	return stateValues;
};

/**
 * Gets national Active, Negative, Suspect, and Recovered, Confirmed, Death counts
 * @param {string} res	The response body string to extract data from
 * @returns {Object}	{ activeCases, negativeCases, suspectCases, recovered, casesAccumulated, deathsAccumulated }
 */
const getNationalCaseData = (res) => ({
	activeCases: getInnerHTML(res, 'gsActDIV'),
	negativeCases: getInnerHTML(res, 'gsNegDIV'),
	suspectCases: getInnerHTML(res, 'gsSosDIV'),
	recovered: getInnerHTML(res, 'gsRecDIV'),
	casesAccumulated: getInnerHTML(res, 'gsPosDIV'),
	deathsAccumulated: getInnerHTML(res, 'gsDefDIV')
});

/**
 * @param {string} res The response body string to extract data from
 * @returns {Array} [{ state: color }, ...] Array of objects describing the traffic light for each state
 */
const getTrafficLight = (res) => {
	const stateColors = {};
	stateIDs.forEach(state => {
		const target = `NColors['${state.id}']`;
		const color = res.substring(res.indexOf(target), res.indexOf(target) + 25).split("'")[3];
		stateColors[state.state] = color;
	});
	return stateColors;
};

const mexicoData = async () => {
	const SOURCE_URL = 'https://coronavirus.gob.mx/datos/Overview/info/getInfo.php';
	const TRAFFICLIGHT_URL = 'https://coronavirus.gob.mx/datos/#SemaFE';

	try {
		const nationalCasesToday = getNationalToday((await axios.post(SOURCE_URL, formData.nationalCasesToday)).data);
		const nationalDeathsToday = getNationalToday((await axios.post(SOURCE_URL, formData.nationalDeathsToday)).data);
		const stateCases = getState((await axios.post(SOURCE_URL, formData.stateCases)).data);
		const stateDeaths = getState((await axios.post(SOURCE_URL, formData.stateDeaths)).data);
		const stateSuspects = getState((await axios.post(SOURCE_URL, formData.stateSuspects)).data);
		const stateNegatives = getState((await axios.post(SOURCE_URL, formData.stateNegatives)).data);
		const { activeCases,
			negativeCases,
			suspectCases,
			recovered,
			casesAccumulated,
			deathsAccumulated } = getNationalCaseData((await axios.post(SOURCE_URL, formData.nationalCaseData)).data);
		const trafficLight = getTrafficLight((await axios.get(TRAFFICLIGHT_URL)).data);

		// merge the State objects together for a cleaner response body
		const stateData = stateIDs.map(state => ({
			state: state.state,
			color: trafficLight[state.state],
			confirmed: stateCases[state.state],
			negative: stateNegatives[state.state],
			suspect: stateSuspects[state.state],
			deaths: stateDeaths[state.state]
		}));

		return {
			updated: Date.now(),
			nationalData: {
				todayCases: {
					sourceUpdated: nationalCasesToday.date,
					male: nationalCasesToday.Masculino,
					female: nationalCasesToday.Femenino,
					total: nationalCasesToday.total
				},
				todayDeaths: {
					sourceUpdated: nationalDeathsToday.date,
					male: nationalDeathsToday.Masculino,
					female: nationalDeathsToday.Femenino,
					total: nationalDeathsToday.total
				},
				casesAccumulated,
				deathsAccumulated,
				activeCases,
				negativeCases,
				suspectCases,
				recovered
			},
			stateData,
			source: 'https://coronavirus.gob.mx/datos/'
		};
	} catch (err) {
		logger.err('Error: Requesting Mexico Gov Data failed!', err);
		return null;
	}
};

module.exports = mexicoData;
