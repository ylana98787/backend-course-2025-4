import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { createServer } from 'http';
import { XMLBuilder } from 'fast-xml-parser';

const program = new Command();

// Налаштування параметрів командного рядка з значеннями за замовчуванням
program
  .option('-i, --input <path>', 'шлях до JSON файлу', 'titanic.json')
  .option('-h, --host <address>', 'адреса сервера', 'localhost')
  .option('-p, --port <number>', 'порт сервера', 3000, parseInt)
  .parse(process.argv);

const options = program.opts();

console.log('Server configuration:');
console.log('- Input file:', options.input);
console.log('- Host:', options.host);
console.log('- Port:', options.port);

// Функція для читання JSONL файлу
async function readJSONLFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    const result = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line.trim());
        result.push(obj);
      } catch (e) {
        console.log('Skipping invalid JSON line:', line.substring(0, 100));
      }
    }
    
    console.log(`Successfully loaded ${result.length} records from JSONL file`);
    return result;
 } catch (error) {
  if (error.code === 'ENOENT') {
    throw new Error('Cannot find input file');
  } else {
    throw new Error(`Cannot read or parse input file: ${error.message}`);
  }
}
}

// Функція для читання звичайного JSON файлу
async function readJSONFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    console.log(`Successfully loaded ${data.length} records from JSON array`);
    return data;
  } catch (error) {
    // Якщо не вдалося прочитати як звичайний JSON, спробуємо як JSONL
    console.log('Trying to read as JSONL format...');
    return await readJSONLFile(filePath);
  }
}

// Перевірка наявності файлу та завантаження даних
let passengersData;
try {
  passengersData = await readJSONFile(options.input);
  
  if (passengersData.length === 0) {
    console.error('No valid data found in the file');
    process.exit(1);
  }
  
  // Виводимо структуру першого запису для діагностики
  console.log('First record structure:', Object.keys(passengersData[0]));
  
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error('Cannot find input file');
  } else {
    console.error('Error loading file:', err.message);
  }
  process.exit(1);
}

// Створення HTTP сервера
const server = createServer(async (req, res) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  
  try {
    // Обробка фавікону (браузери автоматично роблять цей запит)
    if (req.url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Отримання параметрів запиту
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const showSurvived = urlParams.searchParams.get('survived') === 'true';
    const showAge = urlParams.searchParams.get('age') === 'true';

    console.log(`Query params - survived: ${showSurvived}, age: ${showAge}`);

    // Фільтрація та форматування даних
    let filteredPassengers = passengersData;
    
    if (showSurvived) {
      filteredPassengers = filteredPassengers.filter(p => p.Survived == 1); // Використовуємо == замість === для безпеки
      console.log(`Filtered by survival. Records left: ${filteredPassengers.length}`);
    }

    const outputData = filteredPassengers.map(passenger => {
      const passengerData = {};
      
      // Безпечне отримання значень (на випадок відсутності полів)
      const name = passenger.Name || passenger.name || 'Unknown';
      const age = passenger.Age !== undefined ? passenger.Age : (passenger.age !== undefined ? passenger.age : 'N/A');
      const ticket = passenger.Ticket || passenger.ticket || 'N/A';
      const survived = passenger.Survived !== undefined ? passenger.Survived : passenger.survived;
      
      if (showAge) {
        passengerData.name = name;
        passengerData.age = age;
        passengerData.ticket = ticket;
      } else {
        passengerData.name = name;
        passengerData.ticket = ticket;
      }
      
      return { passenger: passengerData };
    });

    console.log(`Prepared ${outputData.length} records for XML conversion`);

    // Формування XML
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      suppressEmptyNode: true
    });
    
    const xmlData = {
      passengers: {
        passenger: outputData.map(item => item.passenger)
      }
    };
    
    const xml = builder.build(xmlData);

    // Відправлення відповіді
    res.writeHead(200, { 
      'Content-Type': 'application/xml',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(xml);
    
    console.log('Response sent successfully');

  } catch (error) {
    console.error('Error processing request:', error);
    console.error('Error stack:', error.stack);
    
    res.writeHead(500, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ 
      error: 'Internal Server Error', 
      message: error.message 
    }));
  }
});

// Запуск сервера
server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
  console.log(`Using data file: ${options.input}`);
});

// Обробка помилок сервера
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Обробка завершення процесу
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});