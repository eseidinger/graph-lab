-- The AGE image creates the extension in its earlier init script.
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT create_graph('graph_lab');
