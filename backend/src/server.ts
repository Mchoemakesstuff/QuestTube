import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { quizRoutes } from './routes/quizRoutes';

dotenv.config();

const server: FastifyInstance = Fastify({
    logger: true
});

// Enable CORS for Chrome extension
server.register(cors, {
    origin: true, // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

// Health check
server.get('/', async (request, reply) => {
    return { status: 'ok', service: 'YouTube Quizzer API' };
});

// Register routes
server.register(quizRoutes);

const start = async () => {
    try {
        const port = Number(process.env.PORT) || 3000;
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server running on http://localhost:${port}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
