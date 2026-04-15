# GIF247439 - Gym Progress Tracker

Node.js aplikácia na zapisovanie tréningov, sérií a opakovaní s vizualizáciou progresu v grafoch.

## Funkcie

- login podľa `username` (ak neexistuje, používateľ sa vytvorí)
- vytváranie tréningov
- pridávanie sérií (`exercise`, `weight`, `reps`)
- história tréningov
- progres graf (max váha + objem podľa dátumu) pre vybraný cvik

## Požiadavky

- Node.js 18+
- npm
- MSSQL databáza s tabuľkami `Users`, `Workouts`, `Sets`

## Inštalácia

```bash
npm install
```

## Nastavenie prostredia

Pred spustením nastav tieto premenné:

```bash
export DB_USER="<db_user>"
export DB_PASS="<db_password>"
export DB_SERVER="<db_server>"
export DB_NAME="<db_name>"
export PORT="3000"
```

## Spustenie

```bash
npm start
```

## Endpointy

- `POST /login` body: `{ "username": "meno" }`
- `POST /workouts` body: `{ "user_id": 1, "date": "2026-04-15T18:30" }` (`date` je voliteľný)
- `POST /workouts/:workoutId/sets` body: `{ "exercise": "Bench Press", "weight": 80, "reps": 8 }`
- `GET /users/:userId/workouts`
- `GET /users/:userId/exercises`
- `GET /users/:userId/progress?exercise=Bench%20Press`
- `GET /health`

## SQL schéma (ak by si ju potreboval znovu vytvoriť)

```sql
CREATE TABLE Users (
	id INT IDENTITY PRIMARY KEY,
	username NVARCHAR(50) UNIQUE NOT NULL,
	created_at DATETIME DEFAULT GETDATE()
);

CREATE TABLE Workouts (
	id INT IDENTITY PRIMARY KEY,
	user_id INT,
	date DATETIME DEFAULT GETDATE(),
	FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE TABLE Sets (
	id INT IDENTITY PRIMARY KEY,
	workout_id INT,
	exercise NVARCHAR(100),
	weight FLOAT,
	reps INT,
	FOREIGN KEY (workout_id) REFERENCES Workouts(id)
);
```