use serde::{Deserialize, Deserializer, Serializer};

/// SQLite / Go sqlc often stores booleans as 0/1 integers.
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
