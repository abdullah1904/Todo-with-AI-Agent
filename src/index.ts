import { eq, ilike } from "drizzle-orm";
import { db } from "./db";
import { TodosTable } from "./db/schema";
import OpenAI from "openai";
import readlineSync from "readline-sync"
import "dotenv/config";


const tools = {
    getAllTodos: async () => {
        const todos = await db.select().from(TodosTable);
        return todos;
    },
    createTodo: async (todo: string) => {
        const [result] = await db.insert(TodosTable).values({ todo }).returning({ id: TodosTable.id });
        return result.id;
    },
    deleteTodoById: async (id: number) => {
        const deletedTodo = await db.delete(TodosTable).where(eq(TodosTable.id, id)).returning();
        return deletedTodo;
    },
    searchTodo: async (search: string) => {
        const todos = await db.select().from(TodosTable).where(ilike(TodosTable.todo, `%${search}%`));
        return todos;
    }
}

const SYSTEM_PROMPT = `

You are an AI To-Do Assistant with START, PLAN, ACTION, Observation and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, Take the action with appropriate tools and wait for Observation based on Action.
Once you get the observation, Return the AI response based on START prompt and observations.


You can manage tasks by adding, viewing, updating, and deleting them.
You are strictly follow the JSON output format.

Todo DB Schema: 
id: Int and Primary Key,
todo: String, 
created_At: DateTime, 
updated_At: DateTime

Available Tools:
- getAllTodos: Returns all the todos from the database.
- createTodo(todo: string): Creates a new todo in the database and takes todo as a string and returns the ID of created todo.
- deleteTodoById(id: number): Deletes a todo by the ID given in the DB.
- searchTodo(search: string): Searches for all todos matching the query string using ilike operator.

Example:
START
{"type":"user", "user": "Add a task for shopping groceries."}
{"type": "plan", "plan": "I will try to get more context on what user needs to shop."}
{"type": "output", "output": "Can you tell me what all items you want to shop for?"}
{"type": "user", "user": "I want to shop milk, chocolates and bread."}
{"type":"plan", "plan": "I will use createTodo to create a new task."}
{"type":"action", "function": "createTodo", input: "Shop for milk, chocolates and bread."}
{"type": "observation", "observation": "2"}
{"type": "output", "output": "Your todo has been added successfully"}
`

const messages = [
    { "role": "system", "content": SYSTEM_PROMPT },
]

const client = new OpenAI();

(async () => {
    while (true) {
        const query = readlineSync.question('>>');
        messages.push({ role: "user", content: JSON.stringify({ type: "user", user: query }) });

        while (true) {
            const chat = await client.chat.completions.create({
                model: 'gpt-4o-mini',
                // @ts-ignore
                messages: messages,
                response_format: { type: 'json_object' },
            });

            const result = chat.choices[0].message.content;
            messages.push({ role: "assistant", content: result! });
            // console.log("\n\n--- AI Start ---")
            // console.log(result)
            // console.log("--- AI End ---\n\n")
            const action = JSON.parse(result!);
            if (action.type == "output") {
                console.log(`AI: ${action.output}`);
                break;
            } else if (action.type == "action") {
                const fn = tools[action.function];
                if (!fn) throw new Error("Invalid Tool Call");
                const observation = await fn(action.input);
                const obs = { "type": "observation", "observation": observation };
                messages.push({ role: "developer", content: JSON.stringify(obs) });
            }
        }
    }
})();