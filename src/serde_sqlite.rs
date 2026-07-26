use serde::{Deserialize, Deserializer, Serializer};

/// SQLite / Go sqlc store booleans as `INTEGER` 0/1.
///
/// Use these helpers only for that wire shape (`serialize_with` /
/// `deserialize_with` on DB row / op-arg fields). Do not use them for
/// ordinary Rust bool↔int conversions unrelated to SQLite.
pub fn bool_from_int<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Repr {
        Bool(bool),
        Int(i64),
    }
    match Repr::deserialize(deserializer)? {
        Repr::Bool(v) => Ok(v),
        Repr::Int(v) => Ok(v != 0),
    }
}

pub fn bool_to_int<S>(value: &bool, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_i64(i64::from(*value))
}
