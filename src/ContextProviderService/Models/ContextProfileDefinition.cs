namespace ContextProviderService.Models;

public class ContextProfileDefinition
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string[] DataSources { get; set; } = Array.Empty<string>();

    public ContextProfileDefinition() { }

    public ContextProfileDefinition(string name, string description, string[] dataSources)
    {
        Name = name;
        Description = description;
        DataSources = dataSources;
    }
}
