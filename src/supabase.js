
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ieackvxyporefhgbujqo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllYWNrdnh5cG9yZWZoZ2J1anFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjIyNzIsImV4cCI6MjA5MTkzODI3Mn0.PRZ-C0VE0SwfPnz04IRjGR49gMkHrK7rsRC1m4j7ak8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
//new key will be added later
