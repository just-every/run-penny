CREATE TABLE penny_products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) > 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE penny_components (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES penny_products(id), name TEXT NOT NULL CHECK(length(trim(name)) > 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX penny_components_product ON penny_components(product_id);
CREATE TABLE penny_features (
 id TEXT PRIMARY KEY, component_id TEXT NOT NULL REFERENCES penny_components(id), name TEXT NOT NULL CHECK(length(trim(name)) > 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX penny_features_component ON penny_features(component_id);
CREATE TABLE penny_feature_requests (
 request_id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE, feature_id TEXT NOT NULL REFERENCES penny_features(id), created_at TEXT NOT NULL
);
CREATE INDEX penny_feature_requests_feature ON penny_feature_requests(feature_id);
CREATE TABLE penny_feature_roadmap (
 roadmap_item_id TEXT PRIMARY KEY REFERENCES roadmap_items(id) ON DELETE CASCADE, feature_id TEXT NOT NULL REFERENCES penny_features(id), created_at TEXT NOT NULL
);
CREATE INDEX penny_feature_roadmap_feature ON penny_feature_roadmap(feature_id);
