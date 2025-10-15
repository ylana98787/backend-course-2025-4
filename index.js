import { Command } from 'commander';
import fs from 'fs';
import http from 'http';

const program = new Command();

program
  .requiredOption('-i, --input <path>', 'шлях до файлу для читання')
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .parse(process.argv);

const options = program.opts();

// Перевірка існування файлу
if (!fs.existsSync(options.input)) {
  console.error('Cannot find input file');
  process.exit(1);
}

// Читання файлу (необов'язково, тут для прикладу)
const fileContent = fs.readFileSync(options.input, 'utf-8');
console.log(`Файл успішно прочитано, розмір: ${fileContent.length} символів.`);

// Створення HTTP-сервера
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server is running!\n');
});

// Запуск сервера на host та port
server.listen(options.port, options.host, () => {
  console.log(`Сервер запущено на http://${options.host}:${options.port}`);
});
