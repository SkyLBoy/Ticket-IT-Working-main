#  Ticket IT Working

Sistema de gestión de tickets de soporte técnico diseñado para optimizar el flujo de trabajo entre usuarios y el departamento de IT. Permite reportar incidencias, asignar responsables, dar seguimiento en tiempo real y gestionar el ciclo de vida completo de cada solicitud.

## Características Principales

- **Autenticación de usuarios**: Registro e inicio de sesión seguro (Roles: Admin, Usuario).
- **Gestión de tickets**: Creación, edición, eliminación y consulta de incidencias.
- **Historial de estados**: Seguimiento del cambio de estados (*Abierto → En Progreso → Resuelto → Cerrado*).

## Tecnologías Utilizadas

| Capa           | Tecnología / Herramienta                          |
| :------------- | :----------------------------------------------- |
| **Frontend**   | React (Create React App / Vite)                  |
| **Backend**    | Python 3.x + FastAPI + Uvicorn                   |
| **Base Datos** | MongoDB (Local o MongoDB Atlas)                  |
| **Autenticación** | JWT (JSON Web Tokens)                         |
---------------------------------------------------------------------

## Requisitos Previos

Antes de empezar, asegúrate de tener instalado lo siguiente:

- **Node.js** (v16 o superior) y **npm**
- **Python** (v3.8 o superior) y **pip**
- **MongoDB** (instancia local o cuenta en MongoDB Atlas)


## Instalación y Configuración

Sigue estos pasos para poner el proyecto en funcionamiento en tu entorno local.

## Ejecutar programa

Ejecutar frontend 'npm start'
Conectar base de datos 'MongoDB'
Ejecutar backend 'python -m uvicorn server:app --reload --port 8000'