--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.activities (
    id integer NOT NULL,
    phase_id integer NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    description text,
    unit_price numeric(10,2) DEFAULT '0'::numeric
);


ALTER TABLE public.activities OWNER TO neondb_owner;

--
-- Name: activities_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activities_id_seq OWNER TO neondb_owner;

--
-- Name: activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.activities_id_seq OWNED BY public.activities.id;


--
-- Name: activity_compositions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.activity_compositions (
    id integer NOT NULL,
    activity_id integer NOT NULL,
    material_id integer,
    labor_id integer,
    tool_id integer,
    description text NOT NULL,
    unit text NOT NULL,
    quantity numeric(10,4) NOT NULL,
    unit_cost numeric(10,2) NOT NULL,
    type text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.activity_compositions OWNER TO neondb_owner;

--
-- Name: activity_compositions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.activity_compositions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_compositions_id_seq OWNER TO neondb_owner;

--
-- Name: activity_compositions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.activity_compositions_id_seq OWNED BY public.activity_compositions.id;


--
-- Name: budget_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.budget_items (
    id integer NOT NULL,
    budget_id integer NOT NULL,
    activity_id integer NOT NULL,
    phase_id integer,
    quantity numeric(10,3) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL
);


ALTER TABLE public.budget_items OWNER TO neondb_owner;

--
-- Name: budget_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.budget_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.budget_items_id_seq OWNER TO neondb_owner;

--
-- Name: budget_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.budget_items_id_seq OWNED BY public.budget_items.id;


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.budgets (
    id integer NOT NULL,
    project_id integer NOT NULL,
    phase_id integer,
    total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.budgets OWNER TO neondb_owner;

--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.budgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.budgets_id_seq OWNER TO neondb_owner;

--
-- Name: budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.budgets_id_seq OWNED BY public.budgets.id;


--
-- Name: city_price_factors; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.city_price_factors (
    id integer NOT NULL,
    city text NOT NULL,
    country text DEFAULT 'Bolivia'::text NOT NULL,
    materials_factor numeric(10,4) DEFAULT 1.0000 NOT NULL,
    labor_factor numeric(10,4) DEFAULT 1.0000 NOT NULL,
    equipment_factor numeric(10,4) DEFAULT 1.0000 NOT NULL,
    transport_factor numeric(10,4) DEFAULT 1.0000 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.city_price_factors OWNER TO neondb_owner;

--
-- Name: city_price_factors_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.city_price_factors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.city_price_factors_id_seq OWNER TO neondb_owner;

--
-- Name: city_price_factors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.city_price_factors_id_seq OWNED BY public.city_price_factors.id;


--
-- Name: company_advertisements; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.company_advertisements (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    title text NOT NULL,
    description text,
    image_url text NOT NULL,
    link_url text,
    ad_type text DEFAULT 'banner'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    start_date timestamp without time zone DEFAULT now(),
    end_date timestamp without time zone,
    view_count integer DEFAULT 0 NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.company_advertisements OWNER TO neondb_owner;

--
-- Name: company_advertisements_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.company_advertisements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_advertisements_id_seq OWNER TO neondb_owner;

--
-- Name: company_advertisements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.company_advertisements_id_seq OWNED BY public.company_advertisements.id;


--
-- Name: construction_phases; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.construction_phases (
    id integer NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public.construction_phases OWNER TO neondb_owner;

--
-- Name: construction_phases_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.construction_phases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.construction_phases_id_seq OWNER TO neondb_owner;

--
-- Name: construction_phases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.construction_phases_id_seq OWNED BY public.construction_phases.id;


--
-- Name: consultation_messages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.consultation_messages (
    id integer NOT NULL,
    user_id integer,
    name text NOT NULL,
    email text NOT NULL,
    message_type text DEFAULT 'consulta'::text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'pendiente'::text NOT NULL,
    admin_response text,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    responded_at timestamp without time zone
);


ALTER TABLE public.consultation_messages OWNER TO neondb_owner;

--
-- Name: consultation_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.consultation_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.consultation_messages_id_seq OWNER TO neondb_owner;

--
-- Name: consultation_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.consultation_messages_id_seq OWNED BY public.consultation_messages.id;


--
-- Name: labor_categories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.labor_categories (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    unit text NOT NULL,
    hourly_rate numeric(10,2) NOT NULL,
    skill_level text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.labor_categories OWNER TO neondb_owner;

--
-- Name: labor_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.labor_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.labor_categories_id_seq OWNER TO neondb_owner;

--
-- Name: labor_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.labor_categories_id_seq OWNED BY public.labor_categories.id;


--
-- Name: material_categories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.material_categories (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.material_categories OWNER TO neondb_owner;

--
-- Name: material_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.material_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.material_categories_id_seq OWNER TO neondb_owner;

--
-- Name: material_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.material_categories_id_seq OWNED BY public.material_categories.id;


--
-- Name: material_supplier_prices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.material_supplier_prices (
    id integer NOT NULL,
    material_id integer NOT NULL,
    supplier_id integer NOT NULL,
    price numeric(12,4) NOT NULL,
    currency text DEFAULT 'BOB'::text NOT NULL,
    minimum_quantity numeric(10,2) DEFAULT 1.00,
    lead_time_days integer DEFAULT 0,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    last_updated timestamp without time zone DEFAULT now(),
    valid_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.material_supplier_prices OWNER TO neondb_owner;

--
-- Name: material_supplier_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.material_supplier_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.material_supplier_prices_id_seq OWNER TO neondb_owner;

--
-- Name: material_supplier_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.material_supplier_prices_id_seq OWNED BY public.material_supplier_prices.id;


--
-- Name: materials; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.materials (
    id integer NOT NULL,
    category_id integer NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    price numeric(10,2) NOT NULL,
    description text,
    last_updated timestamp without time zone DEFAULT now()
);


ALTER TABLE public.materials OWNER TO neondb_owner;

--
-- Name: materials_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.materials_id_seq OWNER TO neondb_owner;

--
-- Name: materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.materials_id_seq OWNED BY public.materials.id;


--
-- Name: price_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.price_settings (
    id integer NOT NULL,
    usd_exchange_rate numeric(10,4) DEFAULT 6.96 NOT NULL,
    inflation_factor numeric(10,4) DEFAULT 1.0000 NOT NULL,
    global_adjustment_factor numeric(10,4) DEFAULT 1.0000 NOT NULL,
    last_updated timestamp without time zone DEFAULT now() NOT NULL,
    updated_by text
);


ALTER TABLE public.price_settings OWNER TO neondb_owner;

--
-- Name: price_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.price_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.price_settings_id_seq OWNER TO neondb_owner;

--
-- Name: price_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.price_settings_id_seq OWNED BY public.price_settings.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name text NOT NULL,
    client text,
    location text,
    city text,
    country text DEFAULT 'Bolivia'::text,
    start_date timestamp without time zone,
    user_id integer,
    status text DEFAULT 'planning'::text NOT NULL,
    equipment_percentage numeric(5,2) DEFAULT 5.00 NOT NULL,
    administrative_percentage numeric(5,2) DEFAULT 8.00 NOT NULL,
    utility_percentage numeric(5,2) DEFAULT 15.00 NOT NULL,
    tax_percentage numeric(5,2) DEFAULT 3.09 NOT NULL,
    social_charges_percentage numeric(5,2) DEFAULT 71.18 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.projects OWNER TO neondb_owner;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.projects_id_seq OWNER TO neondb_owner;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: supplier_companies; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.supplier_companies (
    id integer NOT NULL,
    user_id integer NOT NULL,
    company_name text NOT NULL,
    business_type text,
    speciality text,
    description text,
    address text,
    city text,
    country text DEFAULT 'Bolivia'::text,
    phone text,
    whatsapp text,
    website text,
    facebook text,
    logo_url text,
    image_urls text[],
    membership_type text DEFAULT 'free'::text NOT NULL,
    membership_expires_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    rating numeric(3,2) DEFAULT 0.00,
    review_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.supplier_companies OWNER TO neondb_owner;

--
-- Name: supplier_companies_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.supplier_companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.supplier_companies_id_seq OWNER TO neondb_owner;

--
-- Name: supplier_companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.supplier_companies_id_seq OWNED BY public.supplier_companies.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    setting_key text NOT NULL,
    setting_value text NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.system_settings OWNER TO neondb_owner;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO neondb_owner;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: tools; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tools (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    unit text NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tools OWNER TO neondb_owner;

--
-- Name: tools_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.tools_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tools_id_seq OWNER TO neondb_owner;

--
-- Name: tools_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.tools_id_seq OWNED BY public.tools.id;


--
-- Name: user_material_prices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_material_prices (
    id integer NOT NULL,
    user_id integer NOT NULL,
    original_material_name text NOT NULL,
    custom_material_name text NOT NULL,
    price numeric(10,2) NOT NULL,
    unit text NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_material_prices OWNER TO neondb_owner;

--
-- Name: user_material_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_material_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_material_prices_id_seq OWNER TO neondb_owner;

--
-- Name: user_material_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_material_prices_id_seq OWNED BY public.user_material_prices.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    first_name text,
    last_name text,
    role text DEFAULT 'user'::text NOT NULL,
    user_type text DEFAULT 'architect'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    city text,
    country text DEFAULT 'Bolivia'::text,
    created_at timestamp without time zone DEFAULT now(),
    last_login timestamp without time zone
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: activities id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activities ALTER COLUMN id SET DEFAULT nextval('public.activities_id_seq'::regclass);


--
-- Name: activity_compositions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activity_compositions ALTER COLUMN id SET DEFAULT nextval('public.activity_compositions_id_seq'::regclass);


--
-- Name: budget_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budget_items ALTER COLUMN id SET DEFAULT nextval('public.budget_items_id_seq'::regclass);


--
-- Name: budgets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budgets ALTER COLUMN id SET DEFAULT nextval('public.budgets_id_seq'::regclass);


--
-- Name: city_price_factors id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.city_price_factors ALTER COLUMN id SET DEFAULT nextval('public.city_price_factors_id_seq'::regclass);


--
-- Name: company_advertisements id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.company_advertisements ALTER COLUMN id SET DEFAULT nextval('public.company_advertisements_id_seq'::regclass);


--
-- Name: construction_phases id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.construction_phases ALTER COLUMN id SET DEFAULT nextval('public.construction_phases_id_seq'::regclass);


--
-- Name: consultation_messages id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultation_messages ALTER COLUMN id SET DEFAULT nextval('public.consultation_messages_id_seq'::regclass);


--
-- Name: labor_categories id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.labor_categories ALTER COLUMN id SET DEFAULT nextval('public.labor_categories_id_seq'::regclass);


--
-- Name: material_categories id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.material_categories ALTER COLUMN id SET DEFAULT nextval('public.material_categories_id_seq'::regclass);


--
-- Name: material_supplier_prices id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.material_supplier_prices ALTER COLUMN id SET DEFAULT nextval('public.material_supplier_prices_id_seq'::regclass);


--
-- Name: materials id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.materials ALTER COLUMN id SET DEFAULT nextval('public.materials_id_seq'::regclass);


--
-- Name: price_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.price_settings ALTER COLUMN id SET DEFAULT nextval('public.price_settings_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: supplier_companies id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.supplier_companies ALTER COLUMN id SET DEFAULT nextval('public.supplier_companies_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: tools id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tools ALTER COLUMN id SET DEFAULT nextval('public.tools_id_seq'::regclass);


--
-- Name: user_material_prices id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_material_prices ALTER COLUMN id SET DEFAULT nextval('public.user_material_prices_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.activities (id, phase_id, name, unit, description, unit_price) FROM stdin;
\.


--
-- Data for Name: activity_compositions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.activity_compositions (id, activity_id, material_id, labor_id, tool_id, description, unit, quantity, unit_cost, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: budget_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.budget_items (id, budget_id, activity_id, phase_id, quantity, unit_price, subtotal) FROM stdin;
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.budgets (id, project_id, phase_id, total, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: city_price_factors; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.city_price_factors (id, city, country, materials_factor, labor_factor, equipment_factor, transport_factor, description, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: company_advertisements; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.company_advertisements (id, supplier_id, title, description, image_url, link_url, ad_type, is_active, start_date, end_date, view_count, click_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: construction_phases; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.construction_phases (id, name, description) FROM stdin;
\.


--
-- Data for Name: consultation_messages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.consultation_messages (id, user_id, name, email, message_type, subject, message, status, admin_response, is_public, created_at, responded_at) FROM stdin;
\.


--
-- Data for Name: labor_categories; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.labor_categories (id, name, description, unit, hourly_rate, skill_level, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: material_categories; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.material_categories (id, name) FROM stdin;
\.


--
-- Data for Name: material_supplier_prices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.material_supplier_prices (id, material_id, supplier_id, price, currency, minimum_quantity, lead_time_days, description, is_active, last_updated, valid_until, created_at) FROM stdin;
\.


--
-- Data for Name: materials; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.materials (id, category_id, name, unit, price, description, last_updated) FROM stdin;
\.


--
-- Data for Name: price_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.price_settings (id, usd_exchange_rate, inflation_factor, global_adjustment_factor, last_updated, updated_by) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.projects (id, name, client, location, city, country, start_date, user_id, status, equipment_percentage, administrative_percentage, utility_percentage, tax_percentage, social_charges_percentage, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: supplier_companies; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.supplier_companies (id, user_id, company_name, business_type, speciality, description, address, city, country, phone, whatsapp, website, facebook, logo_url, image_urls, membership_type, membership_expires_at, is_active, is_verified, rating, review_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.system_settings (id, setting_key, setting_value, description, updated_at) FROM stdin;
\.


--
-- Data for Name: tools; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.tools (id, name, description, unit, unit_price, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_material_prices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_material_prices (id, user_id, original_material_name, custom_material_name, price, unit, reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, email, password, first_name, last_name, role, user_type, is_active, city, country, created_at, last_login) FROM stdin;
\.


--
-- Name: activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.activities_id_seq', 1, false);


--
-- Name: activity_compositions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.activity_compositions_id_seq', 1, false);


--
-- Name: budget_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.budget_items_id_seq', 1, false);


--
-- Name: budgets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.budgets_id_seq', 1, false);


--
-- Name: city_price_factors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.city_price_factors_id_seq', 1, false);


--
-- Name: company_advertisements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.company_advertisements_id_seq', 1, false);


--
-- Name: construction_phases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.construction_phases_id_seq', 1, false);


--
-- Name: consultation_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.consultation_messages_id_seq', 1, false);


--
-- Name: labor_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.labor_categories_id_seq', 1, false);


--
-- Name: material_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.material_categories_id_seq', 1, false);


--
-- Name: material_supplier_prices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.material_supplier_prices_id_seq', 1, false);


--
-- Name: materials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.materials_id_seq', 1, false);


--
-- Name: price_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.price_settings_id_seq', 1, false);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.projects_id_seq', 1, false);


--
-- Name: supplier_companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.supplier_companies_id_seq', 1, false);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 1, false);


--
-- Name: tools_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.tools_id_seq', 1, false);


--
-- Name: user_material_prices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.user_material_prices_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_compositions activity_compositions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activity_compositions
    ADD CONSTRAINT activity_compositions_pkey PRIMARY KEY (id);


--
-- Name: budget_items budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: city_price_factors city_price_factors_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.city_price_factors
    ADD CONSTRAINT city_price_factors_pkey PRIMARY KEY (id);


--
-- Name: company_advertisements company_advertisements_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.company_advertisements
    ADD CONSTRAINT company_advertisements_pkey PRIMARY KEY (id);


--
-- Name: construction_phases construction_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.construction_phases
    ADD CONSTRAINT construction_phases_pkey PRIMARY KEY (id);


--
-- Name: consultation_messages consultation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultation_messages
    ADD CONSTRAINT consultation_messages_pkey PRIMARY KEY (id);


--
-- Name: labor_categories labor_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.labor_categories
    ADD CONSTRAINT labor_categories_pkey PRIMARY KEY (id);


--
-- Name: material_categories material_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.material_categories
    ADD CONSTRAINT material_categories_pkey PRIMARY KEY (id);


--
-- Name: material_supplier_prices material_supplier_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.material_supplier_prices
    ADD CONSTRAINT material_supplier_prices_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: price_settings price_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.price_settings
    ADD CONSTRAINT price_settings_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: supplier_companies supplier_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.supplier_companies
    ADD CONSTRAINT supplier_companies_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_unique UNIQUE (setting_key);


--
-- Name: tools tools_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_pkey PRIMARY KEY (id);


--
-- Name: user_material_prices user_material_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_material_prices
    ADD CONSTRAINT user_material_prices_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: activities activities_phase_id_construction_phases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_phase_id_construction_phases_id_fk FOREIGN KEY (phase_id) REFERENCES public.construction_phases(id);


--
-- Name: activity_compositions activity_compositions_activity_id_activities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activity_compositions
    ADD CONSTRAINT activity_compositions_activity_id_activities_id_fk FOREIGN KEY (activity_id) REFERENCES public.activities(id);


--
-- Name: activity_compositions activity_compositions_labor_id_labor_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activity_compositions
    ADD CONSTRAINT activity_compositions_labor_id_labor_categories_id_fk FOREIGN KEY (labor_id) REFERENCES public.labor_categories(id);


--
-- Name: activity_compositions activity_compositions_material_id_materials_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activity_compositions
    ADD CONSTRAINT activity_compositions_material_id_materials_id_fk FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: activity_compositions activity_compositions_tool_id_tools_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activity_compositions
    ADD CONSTRAINT activity_compositions_tool_id_tools_id_fk FOREIGN KEY (tool_id) REFERENCES public.tools(id);


--
-- Name: budget_items budget_items_activity_id_activities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_activity_id_activities_id_fk FOREIGN KEY (activity_id) REFERENCES public.activities(id);


--
-- Name: budget_items budget_items_budget_id_budgets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_budget_id_budgets_id_fk FOREIGN KEY (budget_id) REFERENCES public.budgets(id);


--
-- Name: budget_items budget_items_phase_id_construction_phases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_phase_id_construction_phases_id_fk FOREIGN KEY (phase_id) REFERENCES public.construction_phases(id);


--
-- Name: budgets budgets_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: company_advertisements company_advertisements_supplier_id_supplier_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.company_advertisements
    ADD CONSTRAINT company_advertisements_supplier_id_supplier_companies_id_fk FOREIGN KEY (supplier_id) REFERENCES public.supplier_companies(id);


--
-- Name: consultation_messages consultation_messages_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultation_messages
    ADD CONSTRAINT consultation_messages_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: material_supplier_prices material_supplier_prices_material_id_materials_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.material_supplier_prices
    ADD CONSTRAINT material_supplier_prices_material_id_materials_id_fk FOREIGN KEY (material_id) REFERENCES public.materials(id);


--
-- Name: material_supplier_prices material_supplier_prices_supplier_id_supplier_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.material_supplier_prices
    ADD CONSTRAINT material_supplier_prices_supplier_id_supplier_companies_id_fk FOREIGN KEY (supplier_id) REFERENCES public.supplier_companies(id);


--
-- Name: materials materials_category_id_material_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_category_id_material_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.material_categories(id);


--
-- Name: projects projects_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: supplier_companies supplier_companies_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.supplier_companies
    ADD CONSTRAINT supplier_companies_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_material_prices user_material_prices_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_material_prices
    ADD CONSTRAINT user_material_prices_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

