// components/seo/SchemaScript.tsx

type SchemaData = Record<string, unknown>;

interface SchemaScriptProps {
  data: SchemaData | SchemaData[];
}

export default function SchemaScript({ data }: SchemaScriptProps) {
  const schemas = Array.isArray(data) ? data : [data];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}